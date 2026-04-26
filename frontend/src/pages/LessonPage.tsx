import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Editor from '@monaco-editor/react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { useLessonStore } from '../store/lessonStore';
import { useConfusionDetector } from '../hooks/useConfusionDetector';
import type { LessonContent } from '../store/lessonStore';
import { ChevronRight, Lightbulb, Sparkles, RefreshCw, Play, Check, Send, MessageSquare, X, BookOpen, Clock, Target } from 'lucide-react';
import FolderPicker from '../components/FolderPicker';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const API = API_BASE.replace(/\/$/, '').replace(/\/api$/, '');

export default function LessonPage() {
    const navigate = useNavigate();
    const { lessons, framework, currentLessonIndex, setCurrentLessonIndex } = useLessonStore();
    const [panelOpen, setPanelOpen] = useState(false);
    const [sectionIdx, setSectionIdx] = useState(0);
    const [startTime] = useState(Date.now());
    const [elapsedMin, setElapsedMin] = useState(0);

    useEffect(() => {
        const t = setInterval(() => setElapsedMin(Math.floor((Date.now() - startTime) / 60000)), 30000);
        return () => clearInterval(t);
    }, []);

    if (!lessons.length) return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '50vh', color: 'var(--text-secondary)' }}>
            No lesson loaded yet. <a href="/" style={{ color: 'var(--accent)', marginLeft: 6, display: 'inline-flex', alignItems: 'center', gap: 4 }}>Start learning <ChevronRight size={14} /></a>
        </div>
    );

    const lesson = lessons[currentLessonIndex] || lessons[0];
    const sections = buildSections(lesson, framework);
    const current = sections[sectionIdx];
    const progress = ((sectionIdx + 1) / sections.length) * 100;

    return (
        <div style={{ display: 'flex', height: 'calc(100vh - 52px)', overflow: 'hidden', background: 'var(--bg-base)' }}>
            {/* LEFT SIDEBAR */}
            <aside style={{
                width: 260, flexShrink: 0, borderRight: '1px solid var(--border)',
                background: 'var(--bg-subtle)', padding: '24px 16px', overflowY: 'auto',
                display: 'flex', flexDirection: 'column',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24, padding: '0 8px' }}>
                    <BookOpen size={20} color="var(--accent)" />
                    <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Curriculum</span>
                </div>

                <div style={{ flex: 1 }}>
                    {sections.map((s, i) => (
                        <SidebarItem 
                            key={i} 
                            label={s.label} 
                            index={i + 1}
                            status={i < sectionIdx ? 'done' : i === sectionIdx ? 'active' : 'pending'}
                            onClick={() => i <= sectionIdx && setSectionIdx(i)} 
                        />
                    ))}
                </div>

                <div style={{ marginTop: 'auto', paddingTop: 16, borderTop: '1px solid var(--border)', padding: '16px 8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-tertiary)', fontSize: 12 }}>
                        <Clock size={14} />
                        <span>Session: {elapsedMin} min</span>
                    </div>
                </div>
            </aside>

            {/* MAIN CONTENT AREA */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative' }}>
                {/* TOP PROGRESS BAR */}
                <div style={{ height: 4, width: '100%', background: 'var(--border)', position: 'absolute', top: 0, zIndex: 10 }}>
                    <div style={{ height: '100%', width: `${progress}%`, background: 'var(--accent)', transition: 'width 300ms ease' }} />
                </div>

                <main style={{ flex: 1, overflowY: 'auto', padding: '48px 48px', maxWidth: 840, margin: '0 auto', width: '100%' }}>
                    {current && (
                        <LessonSection
                            key={sectionIdx}
                            section={current}
                            lesson={lesson}
                            sectionIndex={sectionIdx}
                            total={sections.length}
                            isLast={sectionIdx === sections.length - 1}
                            onNext={() => {
                                if (sectionIdx === sections.length - 1) {
                                    navigate('/assessment');
                                } else {
                                    setSectionIdx(i => Math.min(i + 1, sections.length - 1));
                                }
                            }}
                            onPrev={() => setSectionIdx(i => Math.max(i - 1, 0))}
                        />
                    )}
                </main>
            </div>

            {/* RIGHT DISCUSSION PANEL */}
            <button
                onClick={() => setPanelOpen(o => !o)}
                style={{
                    position: 'fixed', right: panelOpen ? 316 : 24, top: '50%', transform: 'translateY(-50%)',
                    width: 48, height: 48, borderRadius: '12px', background: 'var(--bg-base)',
                    border: '1px solid var(--border)', cursor: 'pointer', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', color: 'var(--text-secondary)', zIndex: 50, transition: 'all 250ms cubic-bezier(0.4, 0, 0.2, 1)',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                }}
                aria-label="Open discussion panel"
            >
                <MessageSquare size={22} />
            </button>

            {panelOpen && (
                <aside style={{
                    width: 320, flexShrink: 0, borderLeft: '1px solid var(--border)',
                    background: 'var(--bg-base)', display: 'flex', flexDirection: 'column',
                    position: 'fixed', right: 0, top: 52, height: 'calc(100vh - 52px)', zIndex: 40,
                    animation: 'slideInRight 250ms ease-out',
                }}>
                    <div style={{ padding: '20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Sparkles size={18} color="var(--accent)" />
                            <span style={{ fontSize: 16, fontWeight: 600 }}>Tutor AI</span>
                        </div>
                        <button className="btn-icon" onClick={() => setPanelOpen(false)}><X size={20} /></button>
                    </div>
                    <DiscussionTextTab lessonContent={lesson.explanation + ' ' + lesson.hook} />
                </aside>
            )}
        </div>
    );
}

/* ─── Sidebar Item ─── */
function SidebarItem({ label, index, status, onClick }: { label: string; index: number; status: 'done' | 'active' | 'pending'; onClick: () => void }) {
    const isActive = status === 'active';
    const isDone = status === 'done';

    return (
        <div 
            onClick={onClick}
            style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: 12, 
                padding: '12px 12px', 
                borderRadius: '12px',
                marginBottom: 4, 
                cursor: status !== 'pending' ? 'pointer' : 'default',
                transition: 'all 200ms ease',
                background: isActive ? 'var(--accent-light)' : 'transparent',
                border: `1px solid ${isActive ? 'var(--accent)' : 'transparent'}`
            }}
        >
            <div style={{
                width: 24, height: 24, borderRadius: '6px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: isDone ? 'var(--accent)' : isActive ? 'var(--bg-base)' : 'var(--bg-subtle)',
                border: `1px solid ${isActive ? 'var(--accent)' : 'var(--border)'}`,
                fontSize: 11, fontWeight: 700,
                color: isDone ? '#fff' : isActive ? 'var(--accent)' : 'var(--text-tertiary)'
            }}>
                {isDone ? <Check size={14} strokeWidth={3} /> : index}
            </div>
            <span style={{
                fontSize: 13, 
                fontWeight: isActive ? 600 : 400,
                color: isActive ? 'var(--text-primary)' : isDone ? 'var(--text-secondary)' : 'var(--text-tertiary)',
            }}>{label}</span>
        </div>
    );
}

/* ─── Lesson Section ─── */
function LessonSection({ section, lesson, sectionIndex, total, isLast, onNext, onPrev }: any) {
    const navigate = useNavigate();
    const [termPopover, setTermPopover] = useState<{ term: string; def: string; x: number; y: number } | null>(null);
    const [codeOutput, setCodeOutput] = useState('');
    const [codeValue, setCodeValue] = useState((lesson.exercise?.starter_code || '') as string);
    const { recordExplainClick, triggered, dismiss } = useConfusionDetector(`section_${sectionIndex}`);
    const [explainContent, setExplainContent] = useState<string | null>(null);
    const [explainLoading, setExplainLoading] = useState(false);

    async function handleExplain(style: string) {
        setExplainLoading(true);
        recordExplainClick();
        try {
            const res = await fetch(`${API}/api/explain`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ block_content: section.content, style, topic: lesson.title }),
            });
            const data = await res.json();
            setExplainContent(data.rewritten);
        } finally { setExplainLoading(false); }
    }

    return (
        <div className="animate-fade-in" style={{ paddingBottom: 64, position: 'relative' }}>
            {/* Confusion Tooltip */}
            {triggered && !explainContent && (
                <div style={{
                    position: 'fixed', bottom: 32, right: 100, zIndex: 100,
                    background: 'var(--bg-base)', border: '1px solid var(--accent)',
                    padding: '16px 20px', borderRadius: '16px', boxShadow: '0 12px 32px rgba(0,0,0,0.15)',
                    display: 'flex', alignItems: 'center', gap: 16, animation: 'fadeInUp 400ms ease'
                }}>
                    <Lightbulb size={24} color="var(--accent)" />
                    <div>
                        <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>Need a hand?</p>
                        <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0 }}>I can explain this in a simpler way.</p>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <button className="btn btn-primary btn-sm" onClick={() => handleExplain('simpler')}>Yes, simplify</button>
                        <button className="btn btn-ghost btn-sm" onClick={dismiss}>No thanks</button>
                    </div>
                </div>
            )}

            {/* Header */}
            <div style={{ marginBottom: 32, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                        <div style={{ padding: '4px 10px', borderRadius: '20px', background: 'var(--accent-light)', color: 'var(--accent)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>
                            Step {sectionIndex + 1}
                        </div>
                        <div style={{ height: 1, flex: 1, background: 'var(--border)' }} />
                    </div>
                    <h1 style={{ fontSize: 32, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.2 }}>{section.label}</h1>
                </div>

                <div style={{ display: 'flex', gap: 8, marginLeft: 24, marginTop: 24 }}>
                    <button className="btn-icon" onClick={() => handleExplain('analogy')} title="Get an analogy" style={{ width: 36, height: 36 }}><Lightbulb size={18} /></button>
                    <button className="btn-icon" onClick={() => handleExplain('simpler')} title="Simplify" style={{ width: 36, height: 36 }}><Sparkles size={18} /></button>
                </div>
            </div>

            {/* Markdown Content */}
            <div className="markdown-content" style={{ fontSize: 16, lineHeight: 1.8, color: 'var(--text-secondary)', position: 'relative' }}>
                {explainLoading && (
                    <div style={{
                        position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.7)', 
                        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10,
                        borderRadius: '12px', backdropFilter: 'blur(2px)'
                    }}>
                        <RefreshCw className="animate-spin" size={24} color="var(--accent)" />
                    </div>
                )}
                <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                        code({ node, inline, className, children, ...props }: any) {
                            const match = /language-(\w+)/.exec(className || '')
                            return !inline && match ? (
                                <div style={{ margin: '24px 0', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border)' }}>
                                    <SyntaxHighlighter
                                        style={vscDarkPlus as any}
                                        language={match[1]}
                                        PreTag="div"
                                        customStyle={{ margin: 0, padding: '20px' }}
                                        {...props}
                                    >
                                        {String(children).replace(/\n$/, '')}
                                    </SyntaxHighlighter>
                                </div>
                            ) : (
                                <code style={{ background: 'var(--bg-subtle)', color: 'var(--accent)', padding: '2px 6px', borderRadius: 4, fontSize: '0.9em', fontFamily: 'JetBrains Mono' }} {...props}>
                                    {children}
                                </code>
                            )
                        },
                        h1: (p) => <h2 style={{ fontSize: 24, fontWeight: 700, marginTop: 40, marginBottom: 16, color: 'var(--text-primary)' }} {...p} />,
                        h2: (p) => <h3 style={{ fontSize: 20, fontWeight: 700, marginTop: 32, marginBottom: 12, color: 'var(--text-primary)' }} {...p} />,
                        h3: (p) => <h4 style={{ fontSize: 18, fontWeight: 600, marginTop: 24, marginBottom: 8, color: 'var(--text-primary)' }} {...p} />,
                        p: (p) => <p style={{ marginBottom: 20 }} {...p} />,
                        ul: (p) => <ul style={{ paddingLeft: 24, marginBottom: 20, listStyleType: 'circle' }} {...p} />,
                        li: (p) => <li style={{ marginBottom: 8 }} {...p} />,
                        blockquote: (p) => <blockquote style={{ borderLeft: '4px solid var(--accent)', paddingLeft: 20, margin: '24px 0', fontStyle: 'italic', color: 'var(--text-tertiary)' }} {...p} />,
                    }}
                >
                    {String(explainContent || section.content).replace(/\\n/g, '\n')}
                </ReactMarkdown>
            </div>

            {/* Navigation Buttons */}
            <div style={{ display: 'flex', gap: 16, marginTop: 48, paddingTop: 32, borderTop: '1px solid var(--border)' }}>
                {sectionIndex > 0 && (
                    <button className="btn btn-secondary" style={{ flex: 1, height: 52 }} onClick={onPrev}>
                        Go Back
                    </button>
                )}
                <button className="btn btn-primary" style={{ flex: 2, height: 52, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, fontSize: 16 }} onClick={onNext}>
                    {isLast ? 'Complete & Start Quiz' : 'Next Step'} 
                    <ChevronRight size={18} />
                </button>
            </div>

            {/* Celebration State for Last Section */}
            {isLast && (
                <div style={{
                    marginTop: 48, padding: '40px', borderRadius: '24px', textAlign: 'center',
                    background: 'linear-gradient(135deg, var(--accent-light) 0%, rgba(255,255,255,0) 100%)',
                    border: '1px solid var(--accent)',
                    position: 'relative', overflow: 'hidden'
                }}>
                    <Target size={48} color="var(--accent)" style={{ marginBottom: 16, opacity: 0.2 }} />
                    <h3 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>You're all caught up!</h3>
                    <p style={{ fontSize: 15, color: 'var(--text-secondary)', marginBottom: 24, maxWidth: 400, margin: '0 auto 24px' }}>
                        You've finished all the sections for this lesson. Great job! Ready to see what you've learned?
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
                        <button className="btn btn-primary btn-lg" onClick={() => navigate('/assessment')} style={{ padding: '16px 48px', fontSize: 18 }}>
                            Begin Assessment
                        </button>
                        <FolderPicker lessonId={lesson.lesson_id || ''} />
                    </div>
                </div>
            )}
        </div>
    );
}

/* ─── Discussion Text Tab ─── */
function DiscussionTextTab({ lessonContent }: { lessonContent: string }) {
    const [messages, setMessages] = useState<{ role: string; content: string }[]>([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);

    async function send() {
        if (!input.trim()) return;
        const newMsg = { role: 'user', content: input };
        setMessages(m => [...m, newMsg]);
        setInput('');
        setLoading(true);
        try {
            const res = await fetch(`${API}/api/chat`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: input, lesson_context: lessonContent, history: messages }),
            });
            const data = await res.json();
            setMessages(m => [...m, { role: 'assistant', content: data.reply }]);
        } finally { setLoading(false); }
    }

    return (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                {messages.length === 0 && (
                    <div style={{ textAlign: 'center', marginTop: 40, padding: 20 }}>
                        <Lightbulb size={32} color="var(--accent)" style={{ opacity: 0.3, marginBottom: 12 }} />
                        <p style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>Ask me anything about this lesson! I'm here to help you understand better.</p>
                    </div>
                )}
                {messages.map((m, i) => (
                    <div key={i} style={{
                        alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '90%',
                        background: m.role === 'user' ? 'var(--accent)' : 'var(--bg-subtle)',
                        color: m.role === 'user' ? '#fff' : 'var(--text-primary)',
                        padding: '10px 14px', borderRadius: m.role === 'user' ? '14px 14px 2px 14px' : '14px 14px 14px 2px', 
                        fontSize: 13, lineHeight: 1.5,
                        boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
                    }}>{m.content}</div>
                ))}
                {loading && <div style={{ color: 'var(--text-tertiary)', fontSize: 12, paddingLeft: 4 }}>AI is thinking...</div>}
            </div>
            <div style={{ padding: '16px', borderTop: '1px solid var(--border)', background: 'var(--bg-subtle)' }}>
                <div style={{ display: 'flex', gap: 8 }}>
                    <input 
                        className="input" 
                        style={{ height: 40, fontSize: 14, borderRadius: '10px' }} 
                        placeholder="Type your question..." 
                        value={input}
                        onChange={e => setInput(e.target.value)} 
                        onKeyDown={e => e.key === 'Enter' && send()} 
                    />
                    <button className="btn btn-primary" onClick={send} disabled={loading} style={{ width: 40, height: 40, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Send size={18} />
                    </button>
                </div>
            </div>
        </div>
    );
}

/* ─── Build sections from lesson ─── */
function buildSections(lesson: LessonContent, _framework: string) {
    const title = lesson.title || 'This Topic';
    const sections: { label: string; content: string; code?: string }[] = [];

    // Section 1: Introduction — hook + objectives combined
    const introLines: string[] = [];
    if (lesson.hook) introLines.push(lesson.hook);
    if (lesson.objectives?.length) {
        introLines.push('\n\n## What you will learn');
        lesson.objectives.forEach((o: string) => introLines.push(`- ${o}`));
    }
    if (lesson.prior_knowledge_check) {
        introLines.push('\n\n> **Before we start:** ' + lesson.prior_knowledge_check);
    }
    if (introLines.length) {
        sections.push({ label: 'Introduction', content: introLines.join('\n') });
    }

    // Section 2: Core Concepts — the main explanation
    if (lesson.explanation) {
        sections.push({ label: 'Concept Deep Dive', content: lesson.explanation });
    }

    // Section 3: Worked Example — walkthrough + code
    const exLines: string[] = [];
    if (lesson.worked_example?.setup) exLines.push(`${lesson.worked_example.setup}\n`);
    if (lesson.worked_example?.code) exLines.push('\n```python\n' + lesson.worked_example.code + '\n```\n');
    if (lesson.worked_example?.walkthrough) exLines.push(`${lesson.worked_example.walkthrough}`);
    if (exLines.length) {
        sections.push({ label: 'Practical Example', content: exLines.join('\n'), code: lesson.worked_example?.code });
    }

    // Section 4: Practice — exercise
    if (lesson.exercise?.instructions) {
        sections.push({
            label: 'Interactive Practice',
            content: lesson.exercise.instructions,
            code: lesson.exercise.starter_code,
        });
    }

    // Section 5: Summary & Key Takeaways
    const sumLines: string[] = [];
    if (lesson.summary) sumLines.push(lesson.summary);
    if (lesson.key_takeaways?.length) {
        sumLines.push('\n\n## Key Takeaways');
        lesson.key_takeaways.forEach((t: string) => sumLines.push(`- ${t}`));
    }
    if (lesson.assessment?.question) {
        sumLines.push('\n\n### Concept Check\n' + lesson.assessment.question);
    }
    if (sumLines.length) {
        sections.push({ label: 'Review & Wrap-up', content: sumLines.join('\n') });
    }

    // Fallback
    if (sections.length === 0) {
        sections.push({ label: 'Lesson Content', content: lesson.explanation || lesson.hook || 'Content is being prepared...' });
    }

    return sections;
}
