import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLessonStore } from '../store/lessonStore';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const AGENT = import.meta.env.VITE_AGENT_URL || 'http://localhost:8000';

const STAGES = [
    { key: 'ingesting', label: 'Reading your content...', progress: 10 },
    { key: 'chunking', label: 'Breaking content into sections...', progress: 20 },
    { key: 'architect', label: 'Designing lesson structure...', progress: 40 },
    { key: 'content', label: 'Writing lesson content...', progress: 60 },
    { key: 'testing', label: 'Testing with a simulated student...', progress: 80 },
    { key: 'refining', label: 'Refining based on test results...', progress: 90 },
    { key: 'complete', label: 'Your lesson is ready!', progress: 100 },
];

type Step = 1 | 2 | 3 | 4;

export default function PreLessonPage() {
    const navigate = useNavigate();
    const { inputContent, chunks, framework, learnerLevel, priorKnowledge,
        setLessons, setStatus, setProgress, setPriorKnowledge, setLessonReady, setLessonId } = useLessonStore();

    const [step, setStep] = useState<Step>(1);
    const [chatMessages, setChatMessages] = useState<{ role: string; content: string }[]>([]);
    const [chatInput, setChatInput] = useState('');
    const [chatLoading, setChatLoading] = useState(false);
    const [prerequisites, setPrerequisites] = useState<any[]>([]);
    const [checkedConcepts, setCheckedConcepts] = useState<Set<string>>(new Set());
    const [stageMessage, setStageMessage] = useState('');
    const [progress, setLocalProgress] = useState(0);
    const topic = useLessonStore(s => s.advisorResult?.topic_name || inputContent.slice(0, 60));

    // Initialize chat
    useEffect(() => {
        if (chatMessages.length === 0) {
            setChatMessages([{ role: 'assistant', content: `Before I build your lesson, tell me — what do you already know about **${topic}**?` }]);
        }
    }, []);

    async function sendChat() {
        if (!chatInput.trim()) return;
        const newMsg = { role: 'user', content: chatInput };
        const updated = [...chatMessages, newMsg];
        setChatMessages(updated);
        setChatInput('');
        setChatLoading(true);
        try {
            const res = await fetch(`${API}/api/chat/prior`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ messages: updated, topic }),
            });
            const data = await res.json();
            setChatMessages(m => [...m, { role: 'assistant', content: data.reply }]);
            if (updated.filter(m => m.role === 'user').length >= 2) {
                await buildPrerequisites(updated);
            }
        } catch (_) { } finally { setChatLoading(false); }
    }

    async function buildPrerequisites(history: any[]) {
        try {
            const res = await fetch(`${AGENT}/advisor/prerequisites`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ topic, conversation_history: history }),
            });
            const data = await res.json();
            setPrerequisites(data.all_prerequisites || []);
            const known = new Set<string>(data.known_concepts || []);
            setCheckedConcepts(known);
            setPriorKnowledge({ known: data.known_concepts || [], gaps: data.gap_concepts || [] });
        } catch (_) { }
    }

    async function startPipeline() {
        setStep(4);
        setStageMessage('Reading your content...');
        setLocalProgress(10);

        const state = {
            raw_input: { type: 'text', content: inputContent },
            chunks,
            framework,
            learner_level: learnerLevel,
            prior_knowledge: priorKnowledge,
            max_iterations: 3,
        };

        const res = await fetch(`${API}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(state),
        });
        if (!res.body) return;

        const reader = res.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const text = decoder.decode(value);
            const lines = text.split('\n').filter(l => l.startsWith('data:'));
            for (const line of lines) {
                try {
                    const parsed = JSON.parse(line.slice(5));
                    const stage = STAGES.find(s => s.key === parsed.stage);
                    if (stage) { setStageMessage(stage.label); setLocalProgress(stage.progress); }
                    if (parsed.stage === 'complete' && parsed.data?.lessons) {
                        setLessons(parsed.data.lessons);
                        setLessonReady(true);
                        const id = `lesson_${Date.now()}`;
                        setLessonId(id);
                        setTimeout(() => navigate('/lesson'), 600);
                    }
                } catch (_) { }
            }
        }
    }

    return (
        <div style={{ display: 'flex', minHeight: 'calc(100vh - 52px)', padding: '40px 24px', gap: 40, maxWidth: 900, margin: '0 auto' }}>
            {/* Vertical stepper */}
            <div style={{ width: 180, flexShrink: 0 }}>
                <VerticalStepper currentStep={step} steps={['What you know', 'Knowledge map', 'Concept check', 'Ready to learn']} />
            </div>

            {/* Main content */}
            <div style={{ flex: 1 }}>
                {step === 1 && (
                    <div className="card animate-fade-in-up">
                        <h2 className="text-h2" style={{ marginBottom: 16 }}>What do you already know?</h2>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16, maxHeight: 300, overflowY: 'auto' }}>
                            {chatMessages.map((m, i) => (
                                <div key={i} style={{
                                    alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                                    background: m.role === 'user' ? 'var(--bg-muted)' : 'var(--accent-light)',
                                    borderRadius: 10, padding: '10px 14px', maxWidth: '85%', fontSize: 14,
                                }}>
                                    {m.content}
                                </div>
                            ))}
                            {chatLoading && <div style={{ alignSelf: 'flex-start', color: 'var(--text-tertiary)', fontSize: 13 }}>Thinking...</div>}
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                            <input className="input" placeholder="Type your answer..." value={chatInput}
                                onChange={e => setChatInput(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && sendChat()} />
                            <button className="btn btn-primary" onClick={sendChat} disabled={chatLoading}>Send</button>
                        </div>
                        {chatMessages.filter(m => m.role === 'user').length >= 2 && (
                            <button className="btn btn-secondary" style={{ marginTop: 12, width: '100%' }} onClick={() => setStep(2)}>
                                Continue →
                            </button>
                        )}
                    </div>
                )}

                {step === 2 && (
                    <div className="card animate-fade-in-up">
                        <h2 className="text-h2" style={{ marginBottom: 8 }}>Your Knowledge Map</h2>
                        <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 16 }}>
                            Green = you know it · Yellow = partial · Violet = learning target
                        </p>
                        <KnowledgeMap prerequisites={prerequisites} checkedConcepts={checkedConcepts} />
                        <button className="btn btn-primary" style={{ marginTop: 16, width: '100%' }} onClick={() => setStep(3)}>
                            Continue →
                        </button>
                    </div>
                )}

                {step === 3 && (
                    <div className="card animate-fade-in-up">
                        <h2 className="text-h2" style={{ marginBottom: 4 }}>Concept Check</h2>
                        <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 16 }}>
                            Tick what you already know — the rest become your learning targets.
                        </p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                            {prerequisites.map((p, i) => (
                                <label key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                                    <input type="checkbox" checked={checkedConcepts.has(p.concept)}
                                        onChange={e => {
                                            const s = new Set(checkedConcepts);
                                            if (e.target.checked) s.add(p.concept); else s.delete(p.concept);
                                            setCheckedConcepts(s);
                                        }}
                                        style={{ accentColor: 'var(--accent)', width: 16, height: 16 }} />
                                    <span style={{ fontSize: 14, color: checkedConcepts.has(p.concept) ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                                        {p.concept}
                                        {p.importance === 'critical' && <span className="badge badge-error" style={{ marginLeft: 6, fontSize: 10 }}>critical</span>}
                                    </span>
                                </label>
                            ))}
                            {prerequisites.length === 0 && (
                                <p style={{ color: 'var(--text-tertiary)' }}>No prerequisites detected — ready to dive in!</p>
                            )}
                        </div>
                        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>
                            {checkedConcepts.size} concepts selected as prior knowledge
                        </p>
                        <button className="btn btn-primary" style={{ width: '100%' }} onClick={startPipeline}>
                            Build my lesson →
                        </button>
                    </div>
                )}

                {step === 4 && (
                    <div className="card animate-fade-in-up" style={{ textAlign: 'center', padding: 40 }}>
                        <div style={{
                            width: 56, height: 56, borderRadius: '50%', background: 'var(--accent)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px',
                        }}>
                            <span style={{ color: '#fff', fontSize: 24 }}>✓</span>
                        </div>
                        <h2 className="text-h2" style={{ marginBottom: 8 }}>Your lesson is being built</h2>
                        <div style={{ height: 4, background: 'var(--bg-muted)', borderRadius: 2, margin: '20px 0', overflow: 'hidden' }}>
                            <div style={{ height: '100%', background: 'var(--accent)', borderRadius: 2, width: `${progress}%`, transition: 'width 400ms ease' }} />
                        </div>
                        <p className="animate-fade-in" style={{ color: 'var(--text-secondary)', fontSize: 14 }}>{stageMessage}</p>
                    </div>
                )}
            </div>
        </div>
    );
}

/* ─── Vertical Stepper ─── */
function VerticalStepper({ currentStep, steps }: { currentStep: number; steps: string[] }) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {steps.map((label, i) => {
                const n = i + 1;
                const done = n < currentStep;
                const active = n === currentStep;
                return (
                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            <div style={{
                                width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
                                border: `2px solid ${done ? 'var(--accent)' : active ? 'var(--accent)' : 'var(--border-strong)'}`,
                                background: done ? 'var(--accent)' : 'var(--bg-base)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>
                                {done && <span style={{ color: '#fff', fontSize: 9 }}>✓</span>}
                                {active && <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)' }} />}
                            </div>
                            {i < steps.length - 1 && <div style={{ width: 1, height: 36, background: 'var(--border)' }} />}
                        </div>
                        <span style={{
                            fontSize: 13, fontWeight: active ? 500 : 400, paddingTop: 1,
                            color: active ? 'var(--text-primary)' : done ? 'var(--text-secondary)' : 'var(--text-tertiary)',
                        }}>{label}</span>
                    </div>
                );
            })}
        </div>
    );
}

/* ─── Knowledge Map (SVG) ─── */
function KnowledgeMap({ prerequisites, checkedConcepts }: { prerequisites: any[]; checkedConcepts: Set<string> }) {
    if (prerequisites.length === 0) return (
        <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-tertiary)' }}>No concepts mapped yet</div>
    );

    const W = 520, H = 200;
    const cols = Math.ceil(prerequisites.length / 2);
    const nodes = prerequisites.slice(0, 8).map((p, i) => ({
        ...p, x: 60 + (i % cols) * 120, y: i < cols ? 40 : 130,
        status: checkedConcepts.has(p.concept) ? 'known' : p.importance === 'critical' ? 'target' : 'partial',
    }));

    const colorMap = { known: { border: '#059669', bg: '#ECFDF5', text: '#059669' }, partial: { border: '#D97706', bg: '#FFFBEB', text: '#D97706' }, target: { border: '#7C3AED', bg: '#EDE9FE', text: '#7C3AED' } };

    return (
        <div style={{ background: 'var(--bg-subtle)', borderRadius: 12, padding: 12, overflowX: 'auto' }}>
            <svg width={W} height={H} style={{ display: 'block', margin: '0 auto' }}>
                {nodes.map((n, i) => {
                    if (i < nodes.length - 1 && i % cols !== cols - 1) {
                        const next = nodes[i + 1];
                        return <line key={`l${i}`} x1={n.x + 40} y1={n.y + 14} x2={next.x} y2={next.y + 14} stroke="var(--border-strong)" strokeWidth="1.5" markerEnd="url(#arrow)" />;
                    }
                    return null;
                })}
                <defs><marker id="arrow" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto"><path d="M0,0 L0,6 L6,3 z" fill="var(--border-strong)" /></marker></defs>
                {nodes.map((n, i) => {
                    const c = colorMap[n.status as keyof typeof colorMap];
                    return (
                        <g key={i}>
                            <rect x={n.x - 4} y={n.y} width={88} height={28} rx="6" fill={c.bg} stroke={c.border} strokeWidth="1.5" />
                            <text x={n.x + 40} y={n.y + 18} textAnchor="middle" fontSize="11" fill={c.text} fontWeight="500">
                                {n.concept.slice(0, 12)}
                            </text>
                        </g>
                    );
                })}
            </svg>
            <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginTop: 8, fontSize: 12, color: 'var(--text-secondary)' }}>
                <span style={{ color: '#059669' }}>● Know it</span>
                <span style={{ color: '#D97706' }}>● Partial</span>
                <span style={{ color: '#7C3AED' }}>● Learning target</span>
            </div>
        </div>
    );
}
