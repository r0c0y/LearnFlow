import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLessonStore } from '../store/lessonStore';
import { Spinner, ErrorMessage } from '../shared/Loading';

const API = import.meta.env.VITE_API_URL || '';

const STAGES = [
    { key: 'ingesting', label: 'Reading your content...', progress: 10 },
    { key: 'chunking', label: 'Breaking content into sections...', progress: 20 },
    { key: 'architect', label: 'Designing lesson structure...', progress: 40 },
    { key: 'content', label: 'Writing lesson content...', progress: 60 },
    { key: 'testing', label: 'Testing with a simulated student...', progress: 80 },
    { key: 'refining', label: 'Refining based on test results...', progress: 90 },
    { key: 'complete', label: 'Your lesson is ready!', progress: 100 },
];

type Step = 1 | 2 | 3 | 4 | 5;

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
    const [error, setError] = useState<string | null>(null);
    const chatContainerRef = useRef<HTMLDivElement>(null);
    const topic = useLessonStore(s => s.advisorResult?.topic_name || inputContent.slice(0, 60));

    // Auto-scroll to bottom when new messages arrive
    useEffect(() => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
    }, [chatMessages]);

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
            const newMessages = [...updated, { role: 'assistant', content: data.reply }];
            setChatMessages(newMessages);

            // Check if we should proceed to next step (after 3-5 user messages)
            const userMessageCount = newMessages.filter(m => m.role === 'user').length;
            if (userMessageCount >= 4) { // Allow 4 exchanges (agent asks, user answers, repeat 2-3 times)
                await buildPrerequisites(newMessages);
                setTimeout(() => setStep(2), 1000);
            }
        } catch (e) {
            console.error('Chat error:', e);
        } finally {
            setChatLoading(false);
        }
    }

    async function buildPrerequisites(history: any[]) {
        try {
            const res = await fetch(`${API}/api/advisor/prerequisites`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ topic, conversation_history: history }),
            });
            const data = await res.json();
            setPrerequisites(data.all_prerequisites || []);
            const known = new Set<string>(data.known_concepts || []);
            setCheckedConcepts(known);
            setPriorKnowledge({ known: data.known_concepts || [], gaps: data.gap_concepts || [] });
        } catch (e) {
            console.error('Prerequisite fetch failed:', e);
        }
    }

    async function startPipeline() {
        setStep(5);
        setStageMessage('Reading your content...');
        setLocalProgress(10);
        setError(null);

        const state = {
            raw_input: { type: 'text', content: inputContent },
            chunks,
            framework,
            learner_level: learnerLevel,
            prior_knowledge: priorKnowledge,
            max_iterations: Number(import.meta.env.VITE_MAX_ITERATIONS || 3),
        };

        let res;
        try {
            res = await fetch(`${API}/api/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(state),
            });
        } catch (fetchError) {
            setError('Failed to connect to the lesson generation service. Please check your internet connection and try again.');
            return;
        }

        if (!res.ok) {
            const errorData = await res.json().catch(() => ({ error: 'Unknown error' }));
            setError(errorData.error || `Server error: ${res.status}`);
            return;
        }

        if (!res.body) {
            setError('Lesson generation response is invalid. Please try again.');
            return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();

        try {
            let buffer = '';
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                const chunk = decoder.decode(value, { stream: true });
                buffer += chunk;

                // Process complete lines
                const lines = buffer.split('\n');
                buffer = lines.pop() || ''; // Keep incomplete line in buffer

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = line.slice(6).trim();
                        if (data) {
                            try {
                                const parsed = JSON.parse(data);
                                const stage = STAGES.find(s => s.key === parsed.stage);
                                if (stage) {
                                    setStageMessage(stage.label);
                                    setLocalProgress(stage.progress);
                                }
                                if (parsed.stage === 'complete' && parsed.data?.lessons) {
                                    setLessons(parsed.data.lessons);
                                    setLessonReady(true);
                                    const id = `lesson_${Date.now()}`;
                                    setLessonId(id);
                                    setTimeout(() => navigate('/lesson'), 600);
                                } else if (parsed.stage === 'error') {
                                    setError(parsed.message || 'An error occurred during lesson generation.');
                                }
                            } catch (parseError) {
                                console.warn('Failed to parse SSE data chunk:', parseError, 'Data:', data.slice(0, 200) + '...');
                                // Continue processing other chunks
                            }
                        }
                    }
                }
            }
        } catch (streamError) {
            console.error('Stream error:', streamError);
            setError('Connection lost during lesson generation. Please try again.');
        }
    }

    return (
        <div style={{ display: 'flex', minHeight: 'calc(100vh - 52px)', padding: '40px 24px', gap: 40, maxWidth: 900, margin: '0 auto' }}>
            {/* Vertical stepper */}
            <div style={{ width: 180, flexShrink: 0 }}>
                <VerticalStepper currentStep={step} steps={['What you know', 'Knowledge map', 'Concept check', 'Curriculum preview', 'Ready to learn']} />
            </div>

            {/* Main content */}
            <div style={{ flex: 1 }}>
                {step === 1 && (
                    <div className="card animate-fade-in-up">
                        <h2 className="text-h2" style={{ marginBottom: 16 }}>What do you already know?</h2>
                        <div ref={chatContainerRef} style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16, maxHeight: 300, overflowY: 'auto' }}>
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
                        {chatMessages.filter(m => m.role === 'user').length < 4 ? (
                            <div style={{ display: 'flex', gap: 8 }}>
                                <input className="input" placeholder="Type your answer..." value={chatInput}
                                    onChange={e => setChatInput(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && sendChat()} />
                                <button className="btn btn-primary" onClick={sendChat} disabled={chatLoading}>Send</button>
                            </div>
                        ) : (
                            <div style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: 14, padding: '12px' }}>
                                ✓ Assessment complete! Analyzing your knowledge...
                            </div>
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
                        <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
                            <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setStep(1)}>
                                ← Back to Chat
                            </button>
                            <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => setStep(3)}>
                                Continue to Check →
                            </button>
                        </div>
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
                        <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => setStep(4)}>
                            Preview Curriculum →
                        </button>
                    </div>
                )}

                {step === 4 && (
                    <div className="card animate-fade-in-up">
                        <h2 className="text-h2" style={{ marginBottom: 8 }}>Curriculum Preview</h2>
                        <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 16 }}>
                            Here's your personalized learning path based on your knowledge assessment
                        </p>
                        <CurriculumPreview topic={topic} framework={framework} learnerLevel={learnerLevel} />
                        <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
                            <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setStep(3)}>
                                ← Back to Check
                            </button>
                            <button className="btn btn-primary" style={{ flex: 1 }} onClick={startPipeline}>
                                Start Building →
                            </button>
                        </div>
                    </div>
                )}

                {step === 5 && (
                    <div className="card animate-fade-in-up" style={{ textAlign: 'center', padding: 40 }}>
                        {error ? (
                            <ErrorMessage error={error} onRetry={() => { setError(null); setStep(4); }} />
                        ) : (
                            <>
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
                            </>
                        )}
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

/* ─── Curriculum Preview ─── */
function CurriculumPreview({ topic, framework, learnerLevel }: { topic: string; framework: string; learnerLevel: string }) {
    const curriculum = [
        { title: 'Introduction & Foundations', duration: '15 min', concepts: ['Basic concepts', 'Key terminology'] },
        { title: 'Core Principles', duration: '25 min', concepts: ['Fundamental rules', 'Important patterns'] },
        { title: 'Practical Application', duration: '30 min', concepts: ['Real-world examples', 'Hands-on practice'] },
        { title: 'Advanced Topics', duration: '20 min', concepts: ['Complex scenarios', 'Best practices'] },
        { title: 'Assessment & Review', duration: '15 min', concepts: ['Knowledge check', 'Progress review'] },
    ];

    const downloadCurriculum = () => {
        const content = `Learning Curriculum: ${topic}\n\nFramework: ${framework}\nLevel: ${learnerLevel}\n\n${curriculum.map((lesson, i) =>
            `Lesson ${i + 1}: ${lesson.title}\nDuration: ${lesson.duration}\nConcepts: ${lesson.concepts.join(', ')}\n`
        ).join('\n')}`;

        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${topic.replace(/\s+/g, '_')}_curriculum.txt`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const downloadMindMap = () => {
        const mindMapContent = `Mind Map for: ${topic}

${curriculum.map((lesson, i) => `${'  '.repeat(i)}${lesson.title}
${'  '.repeat(i + 1)}├─ ${lesson.concepts[0]}
${'  '.repeat(i + 1)}└─ ${lesson.concepts[1] || 'Practice'}`).join('\n')}

Learning Framework: ${framework}
Target Level: ${learnerLevel}`;

        const blob = new Blob([mindMapContent], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${topic.replace(/\s+/g, '_')}_mindmap.txt`;
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div>
                    <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>{topic}</h3>
                    <p style={{ margin: 4, fontSize: 13, color: 'var(--text-secondary)' }}>
                        Framework: {framework} • Level: {learnerLevel}
                    </p>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-secondary btn-sm" onClick={downloadMindMap}>
                        Download mind map
                    </button>
                    <button className="btn btn-secondary btn-sm" onClick={downloadCurriculum}>
                        Download curriculum
                    </button>
                </div>
            </div>

            {/* Mind Map Visualization */}
            <div style={{ background: 'var(--bg-subtle)', borderRadius: 12, padding: 16, marginBottom: 16 }}>
                <h4 style={{ margin: 0, marginBottom: 12, fontSize: 14, fontWeight: 600 }}>Learning Path Mind Map</h4>
                <div style={{ fontFamily: 'JetBrains Mono', fontSize: 13, lineHeight: 1.6, color: 'var(--text-primary)' }}>
                    <div style={{ marginBottom: 8 }}>
                        <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{topic}</span>
                    </div>
                    {curriculum.map((lesson, i) => (
                        <div key={i} style={{ marginLeft: i * 20, marginBottom: 6 }}>
                            <div style={{ color: '#059669', fontWeight: 500 }}>
                                {'  '.repeat(i)}└─ {lesson.title} ({lesson.duration})
                            </div>
                            {lesson.concepts.map((concept, j) => (
                                <div key={j} style={{ marginLeft: (i + 1) * 20, color: 'var(--text-secondary)' }}>
                                    {'  '.repeat(i + 1)}├─ {concept}
                                </div>
                            ))}
                        </div>
                    ))}
                </div>
            </div>

            {/* Detailed Curriculum */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {curriculum.map((lesson, i) => (
                    <div key={i} style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        padding: 12, borderRadius: 8, background: 'var(--bg-subtle)',
                        border: '1px solid var(--border)'
                    }}>
                        <div style={{
                            width: 32, height: 32, borderRadius: '50%',
                            background: 'var(--accent)', color: '#fff',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 14, fontWeight: 600
                        }}>
                            {i + 1}
                        </div>
                        <div style={{ flex: 1 }}>
                            <h4 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>{lesson.title}</h4>
                            <p style={{ margin: 2, fontSize: 12, color: 'var(--text-secondary)' }}>
                                {lesson.duration} • {lesson.concepts.join(', ')}
                            </p>
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 500 }}>
                            {lesson.duration}
                        </div>
                    </div>
                ))}
            </div>

            <div style={{ marginTop: 16, padding: 12, background: 'var(--bg-muted)', borderRadius: 8 }}>
                <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)' }}>
                    <strong>Total Duration:</strong> ~2 hours • <strong>Lessons:</strong> {curriculum.length} •
                    <strong>Assessment:</strong> Interactive quiz at the end
                </p>
            </div>
        </div>
    );
}
