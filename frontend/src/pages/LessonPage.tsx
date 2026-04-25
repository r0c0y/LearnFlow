import { useState, useEffect, useRef } from 'react';
import Editor from '@monaco-editor/react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { useLessonStore } from '../store/lessonStore';
import { useConfusionDetector } from '../hooks/useConfusionDetector';
import { useVoiceRecorder } from '../hooks/useVoiceRecorder';
import type { LessonContent } from '../store/lessonStore';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const FRAMEWORK_LABELS: Record<string, string[]> = {
    gagne: ['Gain Attention', 'Objectives', 'Recall', 'Content', 'Guidance', 'Practice', 'Feedback', 'Assessment', 'Retention'],
    merrill: ['Problem', 'Activation', 'Demonstration', 'Application', 'Integration'],
};

export default function LessonPage() {
    const { lessons, framework, currentLessonIndex, setCurrentLessonIndex } = useLessonStore();
    const [panelOpen, setPanelOpen] = useState(false);
    const [panelTab, setPanelTab] = useState<'text' | 'voice'>('text');
    const [sectionIdx, setSectionIdx] = useState(0);
    const [startTime] = useState(Date.now());
    const [elapsedMin, setElapsedMin] = useState(0);

    useEffect(() => {
        const t = setInterval(() => setElapsedMin(Math.floor((Date.now() - startTime) / 60000)), 30000);
        return () => clearInterval(t);
    }, []);

    if (!lessons.length) return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '50vh', color: 'var(--text-secondary)' }}>
            No lesson loaded yet. <a href="/" style={{ color: 'var(--accent)', marginLeft: 6 }}>Start learning →</a>
        </div>
    );

    const lesson = lessons[currentLessonIndex] || lessons[0];
    const sections = buildSections(lesson, framework);
    const current = sections[sectionIdx];

    return (
        <div style={{ display: 'flex', height: 'calc(100vh - 52px)', overflow: 'hidden' }}>
            {/* LEFT SIDEBAR */}
            <aside style={{
                width: 220, flexShrink: 0, borderRight: '1px solid var(--border)',
                background: 'var(--bg-subtle)', padding: '20px 16px', overflowY: 'auto',
                display: 'flex', flexDirection: 'column',
            }}>
                <p className="text-label" style={{ color: 'var(--text-tertiary)', marginBottom: 16 }}>LESSON PROGRESS</p>
                <div style={{ flex: 1 }}>
                    {sections.map((s, i) => (
                        <SidebarItem key={i} label={s.label} status={i < sectionIdx ? 'done' : i === sectionIdx ? 'active' : 'pending'}
                            onClick={() => i <= sectionIdx && setSectionIdx(i)} />
                    ))}
                </div>
                <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
                    <p className="text-label" style={{ color: 'var(--text-tertiary)' }}>
                        Time spent: {elapsedMin} min
                    </p>
                </div>
            </aside>

            {/* MAIN CONTENT */}
            <main style={{ flex: 1, overflowY: 'auto', padding: '40px 48px', maxWidth: 720, margin: '0 auto', width: '100%' }}>
                {current && (
                    <LessonSection
                        key={sectionIdx}
                        section={current}
                        lesson={lesson}
                        sectionIndex={sectionIdx}
                        total={sections.length}
                        onNext={() => setSectionIdx(i => Math.min(i + 1, sections.length - 1))}
                    />
                )}
            </main>

            {/* RIGHT DISCUSSION PANEL */}
            <button
                onClick={() => setPanelOpen(o => !o)}
                style={{
                    position: 'fixed', right: panelOpen ? 308 : 16, top: '50%', transform: 'translateY(-50%)',
                    width: 40, height: 40, borderRadius: '50%', background: 'var(--bg-base)',
                    border: '1px solid var(--border)', cursor: 'pointer', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', color: 'var(--text-secondary)', zIndex: 50, transition: 'right 250ms ease',
                }}
                aria-label="Open discussion panel"
            >
                💬
            </button>

            {panelOpen && (
                <aside style={{
                    width: 300, flexShrink: 0, borderLeft: '1px solid var(--border)',
                    background: 'var(--bg-base)', display: 'flex', flexDirection: 'column',
                    position: 'fixed', right: 0, top: 52, height: 'calc(100vh - 52px)', zIndex: 40,
                    animation: 'fadeInUp 250ms ease',
                }}>
                    <div style={{ padding: '16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span className="text-h3">Discussion</span>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            {(['text', 'voice'] as const).map(t => (
                                <button key={t} className={`pill-tab${panelTab === t ? ' active' : ''}`} style={{ flex: 'initial', padding: '4px 10px', fontSize: 12 }}
                                    onClick={() => setPanelTab(t)}>{t === 'text' ? 'Text' : 'Voice'}</button>
                            ))}
                            <button className="btn-icon" onClick={() => setPanelOpen(false)}>×</button>
                        </div>
                    </div>
                    {panelTab === 'text' ? (
                        <DiscussionTextTab lessonContent={lesson.explanation + ' ' + lesson.hook} />
                    ) : (
                        <DiscussionVoiceTab lessonContent={lesson.explanation} />
                    )}
                </aside>
            )}
        </div>
    );
}

/* ─── Lesson Section ─── */
function LessonSection({ section, lesson, sectionIndex, total, onNext }: any) {
    const { recordExplainClick, triggered, dismiss } = useConfusionDetector(`section_${sectionIndex}`);
    const [explainContent, setExplainContent] = useState<string | null>(null);
    const [explainLoading, setExplainLoading] = useState(false);
    const [branchContent, setBranchContent] = useState<any | null>(null);
    const [branchLoading, setBranchLoading] = useState(false);
    const [termPopover, setTermPopover] = useState<{ term: string; def: string; x: number; y: number } | null>(null);
    const [codeOutput, setCodeOutput] = useState('');
    const [codeValue, setCodeValue] = useState((lesson.exercise?.starter_code || '') as string);

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

    async function handleBranch(type: 'example' | 'rewrite') {
        setBranchLoading(true);
        try {
            const res = await fetch(`${API}/api/lesson/branch`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ section_id: sectionIndex, type, section_content: section, lesson_title: lesson.title }),
            });
            // Handle HTTP errors cleanly
            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.error || 'Failed to branch lesson');
            }
            const data = await res.json();
            setBranchContent(data.new_content);
        } catch(error) {
            console.error("Branching error:", error);
            // Optionally, we could show an error toast or message here
        } finally { setBranchLoading(false); }
    }

    async function handleTermClick(e: React.MouseEvent, term: string) {
        const rect = (e.target as HTMLElement).getBoundingClientRect();
        try {
            const res = await fetch(`${API}/api/explain/term`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ term, lesson_context: lesson.explanation?.slice(0, 300) }),
            });
            const data = await res.json();
            setTermPopover({ term, def: data.definition, x: rect.left, y: rect.bottom + 4 });
        } catch (_) { }
    }

    async function runCode() {
        setCodeOutput('Running...');
        try {
            // @ts-ignore — Pyodide loaded globally
            if (window.pyodide) {
                // Redirect Python input() to browser prompt() — fixes OSError [Errno 29] on stdin
                await window.pyodide.runPythonAsync(`
import builtins, js
def _browser_input(prompt=""):
    val = js.prompt(str(prompt))
    return val if val is not None else ""
builtins.input = _browser_input
`);
                // Capture printed output via StringIO
                await window.pyodide.runPythonAsync(`
import sys, io
_stdout_capture = io.StringIO()
sys.stdout = _stdout_capture
`);
                try {
                    const result = await window.pyodide.runPythonAsync(codeValue);
                    const printed = await window.pyodide.runPythonAsync(`
sys.stdout = sys.__stdout__
_stdout_capture.getvalue()
`);
                    const out = (printed ? String(printed) : '') + (result !== null && result !== undefined ? '\n→ ' + String(result) : '');
                    setCodeOutput(out.trim() || '(ran successfully — no output)');
                } catch (err: any) {
                    await window.pyodide.runPythonAsync(`sys.stdout = sys.__stdout__`);
                    throw err;
                }
            } else {
                setCodeOutput('⚠️ Pyodide not loaded yet — wait a moment and try again.');
            }
        } catch (e: any) {
            const msg = e.message || String(e);
            setCodeOutput(`Error:\n${msg}`);
        }
    }

    return (
        <div className="animate-fade-in-up">
            {/* Section header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <span className="badge badge-accent">{section.label}</span>
                <h2 className="text-h2">{lesson.title}</h2>
            </div>
            <div className="divider" style={{ marginBottom: 24 }} />

            {/* Confusion detector banner */}
            {triggered && (
                <div style={{
                    background: 'var(--warning-light)', border: '1px solid #FCD34D', borderRadius: 10,
                    padding: '12px 16px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10,
                    animation: 'slideDown 200ms ease',
                }}>
                    <span>💡</span>
                    <span style={{ flex: 1, fontSize: 13 }}>Spending a while here? Want a different explanation?</span>
                    <button className="btn btn-secondary btn-sm" onClick={() => { handleBranch('rewrite'); dismiss(); }}>Try different approach</button>
                    <button className="btn btn-ghost btn-sm" onClick={dismiss}>No thanks</button>
                </div>
            )}

            {/* Main content */}
            <div className="text-left space-y-4">
              <ReactMarkdown 
                remarkPlugins={[remarkGfm]}
                components={{
                  code({node, inline, className, children, ...props}: any) {
                    const match = /language-(\w+)/.exec(className || '')
                    return !inline && match ? (
                      <SyntaxHighlighter
                        style={vscDarkPlus as any}
                        language={match[1]}
                        PreTag="div"
                        className="rounded-md my-4"
                        {...props}
                      >
                        {String(children).replace(/\n$/, '')}
                      </SyntaxHighlighter>
                    ) : (
                      <code className="bg-gray-800 text-gray-200 px-1 py-0.5 rounded" {...props}>
                        {children}
                      </code>
                    )
                  },
                  h1: ({node, ...props}: any) => <h1 className="text-3xl font-bold mt-6 mb-4 text-white" {...props} />,
                  h2: ({node, ...props}: any) => <h2 className="text-2xl font-semibold mt-5 mb-3 text-white" {...props} />,
                  h3: ({node, ...props}: any) => <h3 className="text-xl font-medium mt-4 mb-2 text-white" {...props} />,
                  p: ({node, ...props}: any) => <p className="mb-4 leading-relaxed text-gray-300" {...props} />,
                  ul: ({node, ...props}: any) => <ul className="list-disc pl-6 mb-4 space-y-2 text-gray-300" {...props} />,
                  ol: ({node, ...props}: any) => <ol className="list-decimal pl-6 mb-4 space-y-2 text-gray-300" {...props} />,
                  a: ({node, ...props}: any) => <a className="text-blue-400 hover:text-blue-300 underline" {...props} />,
                  strong: ({node, ...props}: any) => <strong className="font-bold text-white" {...props} />,
                  em: ({node, ...props}: any) => <em className="italic text-gray-200" {...props} />,
                }}
              >
                  {String(branchContent?.content || explainContent || section.content).replace(/\\n/g, '\n')}
              </ReactMarkdown>
            </div>

            {/* Term popover */}
            {termPopover && (
                <div className="card" style={{
                    position: 'fixed', left: termPopover.x, top: termPopover.y, width: 240,
                    zIndex: 200, fontSize: 13, boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
                }}>
                    <strong>{termPopover.term}</strong>
                    <p style={{ marginTop: 4, color: 'var(--text-secondary)' }}>{termPopover.def}</p>
                    <button className="btn btn-ghost btn-sm" style={{ marginTop: 8 }} onClick={() => setTermPopover(null)}>Got it</button>
                </div>
            )}

            {/* Explain differently buttons */}
            <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
                {[{ style: 'simpler', label: '✦ Simpler' }, { style: 'analogy', label: '🔄 Analogy' }, { style: 'realworld', label: '💡 Example' }].map(b => (
                    <button key={b.style} className="btn btn-ghost btn-sm" onClick={() => handleExplain(b.style)} disabled={explainLoading}>
                        {explainLoading ? '...' : b.label}
                    </button>
                ))}
            </div>

            {/* Code playground */}
            {(section.code || lesson.exercise?.starter_code) && (
                <div style={{ marginTop: 24 }}>
                    <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>Try it yourself</p>
                    <Editor
                        height="200px"
                        language="python"
                        theme="vs-dark"
                        value={codeValue}
                        onChange={v => setCodeValue(v || '')}
                        options={{ minimap: { enabled: false }, fontSize: 13, fontFamily: 'JetBrains Mono', scrollBeyondLastLine: false }}
                    />
                    <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                        <button className="btn btn-primary btn-sm" onClick={runCode}>▶ Run</button>
                    </div>
                    {codeOutput && (
                        <pre style={{
                            background: '#0F0F10', color: '#4ADE80', borderRadius: 8, padding: 12,
                            fontFamily: 'JetBrains Mono', fontSize: 13, marginTop: 8, overflowX: 'auto',
                        }}>{codeOutput}</pre>
                    )}
                </div>
            )}

            {/* Lesson branching */}
            <div className="card-subtle" style={{ marginTop: 32, padding: 16 }}>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 10 }}>How did that feel?</p>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button className="btn btn-secondary btn-sm" onClick={onNext}>✓ Got it</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => handleBranch('example')} disabled={branchLoading}>
                        {branchLoading ? '...' : 'Show another example'}
                    </button>
                    <button className="btn btn-ghost btn-sm" style={{ color: 'var(--accent)' }}
                        onClick={() => handleBranch('rewrite')} disabled={branchLoading}>
                        I need more help
                    </button>
                </div>
                {branchContent && (
                    <div className="card-accent animate-fade-in" style={{ marginTop: 12, fontSize: 14 }}>
                        <p>{branchContent.content || branchContent.explanation || branchContent.example_setup}</p>
                        {branchContent.code && (
                            <pre className="code-block" style={{ marginTop: 8 }}>{branchContent.code}</pre>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

/* ─── Rich Text Renderer (highlights technical terms) ─── */
function RichText({ text, onTermClick }: { text: string; onTermClick: (e: React.MouseEvent, term: string) => void }) {
    if (!text) return null;
    // Simple code block detection
    const parts = text.split(/(```[\s\S]*?```)/g);
    return (
        <>
            {parts.map((part, i) => {
                if (part.startsWith('```')) {
                    const code = part.replace(/```\w*\n?/, '').replace(/```$/, '');
                    return <pre key={i} className="code-block" style={{ margin: '16px 0' }}>{code}</pre>;
                }
                return <span key={i} dangerouslySetInnerHTML={{ __html: highlightTerms(part) }}
                    onClick={e => {
                        const t = (e.target as HTMLElement).dataset.term;
                        if (t) onTermClick(e, t);
                    }} />;
            })}
        </>
    );
}

function highlightTerms(text: string) {
    // Highlight CamelCase or code-like words
    return text.replace(/\b([A-Z][a-z]+[A-Z]\w+|\w+\(\)|\w+_\w+)\b/g,
        '<span data-term="$1" style="border-bottom:1.5px dotted var(--accent);cursor:pointer;color:var(--text-primary)">$1</span>');
}

/* ─── Sidebar Item ─── */
function SidebarItem({ label, status, onClick }: { label: string; status: 'done' | 'active' | 'pending'; onClick: () => void }) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, cursor: status !== 'pending' ? 'pointer' : 'default' }} onClick={onClick}>
            <div style={{
                width: 18, height: 18, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: status === 'done' ? 'var(--accent)' : 'var(--bg-base)',
                border: `${status === 'pending' ? 1 : 2}px solid ${status === 'done' ? 'var(--accent)' : status === 'active' ? 'var(--accent)' : 'var(--border-strong)'}`,
            }}>
                {status === 'done' && <span style={{ color: '#fff', fontSize: 9 }}>✓</span>}
                {status === 'active' && <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)' }} />}
            </div>
            <span style={{
                fontSize: 13, fontWeight: status === 'active' ? 500 : 400,
                color: status === 'done' ? 'var(--text-secondary)' : status === 'active' ? 'var(--text-primary)' : 'var(--text-tertiary)',
                textDecoration: status === 'done' ? 'line-through' : 'none',
            }}>{label}</span>
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
            <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {messages.map((m, i) => (
                    <div key={i} style={{
                        alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '85%',
                        background: m.role === 'user' ? 'var(--accent-light)' : 'var(--bg-subtle)',
                        padding: '8px 12px', borderRadius: 10, fontSize: 13,
                    }}>{m.content}</div>
                ))}
                {loading && <div style={{ color: 'var(--text-tertiary)', fontSize: 13 }}>Thinking...</div>}
            </div>
            <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', display: 'flex', gap: 8 }}>
                <input className="input" style={{ height: 36, fontSize: 13 }} placeholder="Ask anything..." value={input}
                    onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()} />
                <button className="btn btn-primary btn-sm" onClick={send} disabled={loading}>→</button>
            </div>
        </div>
    );
}

/* ─── Discussion Voice Tab ─── */
function DiscussionVoiceTab({ lessonContent }: { lessonContent: string }) {
    const { isRecording, audioBlob, toggle } = useVoiceRecorder();
    const [status, setStatus] = useState('Tap to speak');
    const [lastResponse, setLastResponse] = useState('');

    useEffect(() => {
        if (!audioBlob) return;
        setStatus('Processing...');
        const formData = new FormData();
        formData.append('audio', audioBlob, 'recording.webm');
        fetch(`${API}/api/transcribe`, { method: 'POST', body: formData })
            .then(r => r.json())
            .then(async d => {
                const chatRes = await fetch(`${API}/api/chat`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ message: d.text, lesson_context: lessonContent }),
                });
                const chatData = await chatRes.json();
                setLastResponse(chatData.reply);
                setStatus('Tap to speak');
                // TTS
                const utter = new SpeechSynthesisUtterance(chatData.reply);
                window.speechSynthesis.speak(utter);
            })
            .catch(() => setStatus('Error — try again'));
    }, [audioBlob]);

    useEffect(() => { if (isRecording) setStatus('Listening...'); }, [isRecording]);

    return (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 }}>
            <button
                onClick={toggle}
                className={isRecording ? 'animate-pulse-ring' : ''}
                style={{
                    width: 64, height: 64, borderRadius: '50%', cursor: 'pointer',
                    background: isRecording ? 'var(--accent-light)' : 'var(--bg-muted)',
                    border: `2px solid ${isRecording ? 'var(--accent)' : 'var(--border-strong)'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24,
                    transition: 'all 150ms ease',
                }}
                aria-label="Toggle voice recording"
            >🎙</button>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{status}</p>
            {lastResponse && (
                <div className="card-subtle" style={{ fontSize: 13, lineHeight: 1.6, textAlign: 'left', width: '100%' }}>
                    <p>{lastResponse}</p>
                    <button className="btn btn-ghost btn-sm" style={{ marginTop: 8 }}
                        onClick={() => { const u = new SpeechSynthesisUtterance(lastResponse); window.speechSynthesis.speak(u); }}>
                        🔊 Play again
                    </button>
                </div>
            )}
        </div>
    );
}

/* ─── Build sections from lesson ─── */
function buildSections(lesson: LessonContent, framework: string) {
    const labels = FRAMEWORK_LABELS[framework] || FRAMEWORK_LABELS.gagne;
    const contentMap = [
        { label: labels[0], content: lesson.hook || 'Introduction' },
        { label: labels[1], content: lesson.objectives?.join('\n') || '' },
        { label: labels[2], content: lesson.prior_knowledge_check || '' },
        { label: labels[3], content: lesson.explanation || '', code: lesson.worked_example?.code },
        { label: labels[4], content: lesson.worked_example?.walkthrough || '' },
        { label: labels[5], content: lesson.exercise?.instructions || '' },
        { label: labels[6] || 'Feedback', content: lesson.assessment?.question || '' },
    ];
    return contentMap.filter(s => s.content);
}
