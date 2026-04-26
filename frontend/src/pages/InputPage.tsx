import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLessonStore } from '../store/lessonStore';
import type { InputType, Framework, LearnerLevel } from '../store/lessonStore';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const API = API_BASE.replace(/\/$/, '').replace(/\/api$/, '');

const TABS: { id: InputType; label: string }[] = [
    { id: 'prompt', label: 'Topic' },
    { id: 'url', label: 'URL' },
    { id: 'text', label: 'Text' },
    { id: 'file', label: 'File' },
    { id: 'youtube', label: 'YouTube' },
];

export default function InputPage() {
    const navigate = useNavigate();
    const {
        inputType, setInputType, inputContent, setInputContent,
        framework, setFramework, learnerLevel, setLearnerLevel,
        setChunks, setAdvisorResult, advisorResult, setStatus,
    } = useLessonStore();

    const [loading, setLoading] = useState(false);
    const [advisorLoading, setAdvisorLoading] = useState(false);
    const [dragOver, setDragOver] = useState(false);
    const [fileName, setFileName] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const fileRef = useRef<HTMLInputElement>(null);

    /* ─── File / YouTube / URL ingestion helpers ── */
    async function handleFile(file: File) {
        if (!file) return;
        setFileName(file.name);

        if (file.name.endsWith('.pdf')) {
            const formData = new FormData();
            formData.append('file', file);
            const res = await fetch(`${API}/api/ingest/file`, { method: 'POST', body: formData });
            const data = await res.json();
            setInputContent(data.text || '');
        } else if (file.name.endsWith('.docx')) {
            // @ts-ignore
            const mammoth = (await import('mammoth/mammoth.browser.js')).default;
            const buf = await file.arrayBuffer();
            const result = await mammoth.extractRawText({ arrayBuffer: buf });
            setInputContent(result.value || '');
        }
    }

    /* ─── Submit flow ─── */
    async function handleSubmit() {
        if (!inputContent.trim()) { setError('Please enter content first.'); return; }
        setError(null);
        setAdvisorLoading(true);

        try {
            // 1. Run Input Quality Advisor through backend proxy
            const advRes = await fetch(`${API}/api/advisor/analyze`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: inputContent, type: inputType }),
            });
            const advData = await advRes.json();
            setAdvisorResult(advData);

            // 2. Ingest + chunk
            let ingestRes;
            if (inputType === 'url') {
                ingestRes = await fetch(`${API}/api/ingest/url`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ url: inputContent }),
                });
            } else if (inputType === 'youtube') {
                ingestRes = await fetch(`${API}/api/ingest/youtube`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ url: inputContent }),
                });
            } else {
                ingestRes = await fetch(`${API}/api/ingest`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ type: inputType, content: inputContent }),
                });
            }
            const ingestData = await ingestRes.json();
            setChunks(ingestData.chunks || []);
        } catch (e: any) {
            setError(e.message);
        } finally {
            setAdvisorLoading(false);
        }
    }

    async function handleContinue() {
        setLoading(true);
        setStatus('ingesting', 'Reading your content...');
        navigate('/prepare');
    }

    return (
        <div style={{
            minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '24px 16px',
            background: 'radial-gradient(ellipse 80% 50% at 50% -10%, rgba(124,58,237,0.08) 0%, transparent 60%)',
        }}>
            <div style={{ width: '100%', maxWidth: 600 }}>

                {/* AI chip */}
                <div style={{ textAlign: 'center', marginBottom: 16 }}>
                    <span className="badge badge-accent" style={{ borderRadius: 20, padding: '4px 12px', fontSize: 11, letterSpacing: '0.06em' }}>
                        AI-Powered Learning
                    </span>
                </div>

                {/* Headline */}
                <h1 className="text-display" style={{ textAlign: 'center', color: 'var(--text-primary)', marginBottom: 8 }}>
                    What do you want to learn today?
                </h1>
                <p style={{ textAlign: 'center', fontSize: 15, color: 'var(--text-secondary)', marginBottom: 32 }}>
                    Type a topic, paste a URL, drop a file, or share a YouTube link
                </p>

                {/* Tab selector */}
                <div className="pill-tabs" style={{ marginBottom: 16, justifyContent: 'center' }}>
                    {TABS.map(t => (
                        <button key={t.id} className={`pill-tab${inputType === t.id ? ' active' : ''}`}
                            onClick={() => { setInputType(t.id); setInputContent(''); setFileName(null); }}>
                            {t.label}
                        </button>
                    ))}
                </div>

                {/* Input area */}
                <div style={{ marginBottom: 16 }}>
                    {inputType === 'prompt' && (
                        <>
                            <textarea className="textarea" style={{ minHeight: 100 }}
                                placeholder="e.g. Teach me Python list comprehensions from scratch"
                                value={inputContent} onChange={e => setInputContent(e.target.value)} />
                            <div style={{ display: 'flex', gap: 12, marginTop: 10, flexWrap: 'wrap' }}>
                                <ToggleGroup
                                    label="Framework"
                                    options={[{ value: 'gagne', label: 'Gagne' }, { value: 'merrill', label: 'Merrill' }, { value: 'bloom', label: 'Bloom' }]}
                                    value={framework} onChange={v => setFramework(v as Framework)}
                                />
                                <ToggleGroup
                                    label="Level"
                                    options={[{ value: 'beginner', label: 'Beginner' }, { value: 'intermediate', label: 'Intermediate' }, { value: 'expert', label: 'Expert' }]}
                                    value={learnerLevel} onChange={v => setLearnerLevel(v as LearnerLevel)}
                                />
                            </div>
                        </>
                    )}

                    {inputType === 'url' && (
                        <>
                            <input className="input" placeholder="https://docs.example.com/..." value={inputContent} onChange={e => setInputContent(e.target.value)} />
                            <p className="text-small" style={{ color: 'var(--text-tertiary)', marginTop: 6 }}>We'll extract the content automatically</p>
                        </>
                    )}

                    {inputType === 'text' && (
                        <textarea className="textarea" style={{ minHeight: 160 }}
                            placeholder="Paste any documentation, notes, or content here..."
                            value={inputContent} onChange={e => setInputContent(e.target.value)} />
                    )}

                    {inputType === 'file' && (
                        <div
                            style={{
                                border: `2px dashed ${dragOver ? 'var(--accent)' : 'var(--border-strong)'}`,
                                borderRadius: 14, padding: 40,
                                background: dragOver ? 'var(--accent-light)' : 'var(--bg-subtle)',
                                textAlign: 'center', cursor: 'pointer',
                                transition: 'all 150ms ease',
                            }}
                            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                            onDragLeave={() => setDragOver(false)}
                            onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
                            onClick={() => fileRef.current?.click()}
                        >
                            {fileName ? (
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                                    <span className="badge badge-accent">{fileName}</span>
                                    <button className="btn-icon" onClick={e => { e.stopPropagation(); setFileName(null); setInputContent(''); }}
                                        style={{ width: 20, height: 20 }}>×</button>
                                </div>
                            ) : (
                                <>
                                    <div style={{ fontSize: 24, color: 'var(--text-tertiary)', marginBottom: 8 }}>⬆</div>
                                    <p style={{ color: 'var(--text-secondary)', marginBottom: 4 }}>Drop your PDF or DOCX here</p>
                                    <p style={{ fontSize: 13, color: 'var(--accent)', textDecoration: 'underline' }}>or click to browse</p>
                                </>
                            )}
                            <input ref={fileRef} type="file" accept=".pdf,.docx" style={{ display: 'none' }}
                                onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
                        </div>
                    )}

                    {inputType === 'youtube' && (
                        <>
                            <input className="input" placeholder="https://youtube.com/watch?v=..." value={inputContent} onChange={e => setInputContent(e.target.value)} />
                            <p className="text-small" style={{ color: 'var(--text-tertiary)', marginTop: 6 }}>We'll use the video transcript as your lesson source</p>
                        </>
                    )}
                </div>

                {error && <p style={{ color: 'var(--error)', fontSize: 13, marginBottom: 12 }}>{error}</p>}

                {/* Submit button */}
                {!advisorResult && (
                    <button className="btn btn-primary btn-lg" style={{ width: '100%' }}
                        onClick={handleSubmit} disabled={advisorLoading}>
                        {advisorLoading
                            ? <><Spinner /> Analyzing your input...</>
                            : 'Generate My Lesson →'}
                    </button>
                )}

                {/* Input Quality Advisor */}
                {advisorResult && (
                    <div className="card-accent animate-fade-in-up" style={{ marginTop: 16 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                            <span className="text-h3" style={{ color: 'var(--accent)' }}>{advisorResult.topic_name}</span>
                            <span className="badge badge-accent">{advisorResult.complexity_level}</span>
                            <span className="badge badge-muted">{advisorResult.recommended_framework}</span>
                            <span className="badge badge-muted">~{advisorResult.estimated_minutes} min</span>
                        </div>

                        {advisorResult.is_too_broad && (
                            <div style={{ marginBottom: 12 }}>
                                <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8 }}>Here are 3 focused angles:</p>
                                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                    {advisorResult.focused_angles?.map((angle: string, i: number) => (
                                        <button key={i} className="badge badge-accent" style={{ cursor: 'pointer', border: '1px solid var(--accent)', borderRadius: 8, padding: '4px 10px' }}
                                            onClick={() => setInputContent(angle)}>
                                            {angle}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        <button className="btn btn-primary" style={{ width: '100%' }} onClick={handleContinue} disabled={loading}>
                            {loading ? <><Spinner /> Setting up...</> : 'Looks good, continue →'}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

/* ─── Sub-components ─── */
function ToggleGroup({ label, options, value, onChange }: { label: string; options: { value: string; label: string }[]; value: string; onChange: (v: string) => void }) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{label}:</span>
            <div style={{ display: 'flex', gap: 2 }}>
                {options.map(o => (
                    <button key={o.value}
                        style={{
                            padding: '4px 10px', borderRadius: 6, fontSize: 12, fontWeight: 500, border: 'none', cursor: 'pointer',
                            background: value === o.value ? 'var(--accent)' : 'var(--bg-muted)',
                            color: value === o.value ? '#fff' : 'var(--text-secondary)',
                            transition: 'all 150ms ease',
                        }}
                        onClick={() => onChange(o.value)}>
                        {o.label}
                    </button>
                ))}
            </div>
        </div>
    );
}

function Spinner() {
    return <span className="animate-spin" style={{ display: 'inline-block', width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%' }} />;
}
