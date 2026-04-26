import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip } from 'recharts';
import { useLibraryStore } from '../store/libraryStore';
import type { SavedLesson, Folder } from '../store/libraryStore';
import { useLessonStore } from '../store/lessonStore';
import { useAssessmentStore } from '../store/assessmentStore';
import { useAuthStore } from '../store/authStore';
import { authFetch } from '../utils/api';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { Folder as FolderIcon, ChevronDown, ChevronRight, Circle, Book, Trash2, RotateCcw } from 'lucide-react';

const API = import.meta.env.VITE_API_URL || '';

export default function LibraryPage() {
    const navigate = useNavigate();
    const { lessons, folders, activeFolderId, setLessons, setFolders, setActiveFolderId, dueReviews, setDueReviews, statsData, setStatsData, searchQuery, setSearchQuery } = useLibraryStore();
    const { setLessons: setCurrentLessons, setLessonReady, setLessonId } = useLessonStore();
    const { reset: resetAssessment, bumpRetakeKey, setViewingReport } = useAssessmentStore();
    const { user } = useAuthStore();
    const [activeTab, setActiveTab] = useState<'lessons' | 'stats'>('lessons');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user) {
            setLoading(false);
            return;
        }

        Promise.all([
            authFetch(`${API}/api/library`).then(r => r.json()),
            authFetch(`${API}/api/stats`).then(r => r.json()),
            authFetch(`${API}/api/reviews/due`).then(r => r.json()),
        ]).then(([lib, stats, reviews]) => {
            setLessons(lib.lessons || []);
            setFolders(lib.folders || []);
            setStatsData(stats);
            setDueReviews(reviews.due || []);
        }).catch(() => { }).finally(() => setLoading(false));
    }, [user]);

    const filtered = lessons.filter(l => {
        const matchFolder = !activeFolderId || l.folder_id === activeFolderId;
        const matchSearch = !searchQuery || l.title?.toLowerCase().includes(searchQuery.toLowerCase());
        return matchFolder && matchSearch;
    });
    const dueLessons = dueReviews
        .map(review => lessons.find(l => l.id === review.lesson_id))
        .filter((lesson): lesson is any => Boolean(lesson));

    if (!user) {
        return (
            <div style={{ minHeight: 'calc(100vh - 52px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
                <div style={{ maxWidth: 520, textAlign: 'center' }}>
                    <h2 className="text-h2">Please sign in to view your library</h2>
                    <p style={{ color: 'var(--text-secondary)', margin: '16px 0' }}>Your generated lessons, scores, and review schedule are saved securely to your account.</p>
                    <button className="btn btn-primary" onClick={() => navigate('/auth')}>Login or Register</button>
                </div>
            </div>
        );
    }

    function openLesson(lesson: SavedLesson) {
        const content = lesson.content_json;
        const lessonData = Array.isArray(content) ? content : content ? [content] : [];
        // Ensure each lesson has a lesson_id
        const withId = lessonData.map((l: any) => ({ ...l, lesson_id: l.lesson_id || lesson.id }));
        setCurrentLessons(withId);
        setLessonId(lesson.id);
        setLessonReady(true);
        navigate('/lesson');
    }

    function openAssessment(lesson: SavedLesson) {
        const content = lesson.content_json;
        const lessonData = Array.isArray(content) ? content : content ? [content] : [];
        const withId = lessonData.map((l: any) => ({ ...l, lesson_id: l.lesson_id || lesson.id }));
        setCurrentLessons(withId);
        setLessonId(lesson.id);
        setLessonReady(true);
        // Fully reset assessment state and bump retake key to force fresh questions
        resetAssessment();
        bumpRetakeKey();
        navigate('/assessment');
    }

    function viewSavedAssessment(lesson: SavedLesson, assessment: any) {
        const content = lesson.content_json;
        const lessonData = Array.isArray(content) ? content : content ? [content] : [];
        const withId = lessonData.map((l: any) => ({ ...l, lesson_id: l.lesson_id || lesson.id }));
        setCurrentLessons(withId);
        setLessonId(lesson.id);
        setLessonReady(true);
        // Set the viewing report so AssessmentPage shows it
        setViewingReport(assessment);
        navigate('/assessment');
    }

    async function exportPDF() {
        const el = document.getElementById('lesson-content-export');
        if (!el) return;
        const canvas = await html2canvas(el);
        const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        const w = pdf.internal.pageSize.getWidth();
        const h = (canvas.height * w) / canvas.width;
        pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, w, h);
        pdf.save('learnflow-lesson.pdf');
    }

    async function exportMarkdown(lesson: SavedLesson) {
        const content = lesson.content_json;
        const md = `# ${lesson.title}\n\n${JSON.stringify(content, null, 2)}`;
        const blob = new Blob([md], { type: 'text/markdown' });
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${lesson.title}.md`; a.click();
    }

    async function exportAnki(lesson: SavedLesson) {
        const res = await authFetch(`${API}/api/export/anki`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ lesson_id: lesson.id }),
        });
        const blob = await res.blob();
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${lesson.title}.apkg`; a.click();
    }

    return (
        <div style={{ display: 'flex', height: 'calc(100vh - 52px)', overflow: 'hidden' }}>
            {/* LEFT SIDEBAR */}
            <aside style={{ width: 240, flexShrink: 0, borderRight: '1px solid var(--border)', background: 'var(--bg-subtle)', padding: '20px 12px', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
                <p className="text-label" style={{ color: 'var(--text-tertiary)', marginBottom: 8 }}>MY LIBRARY</p>

                {/* Search */}
                <div style={{ position: 'relative', marginBottom: 16 }}>
                    <input className="input" style={{ height: 36, paddingLeft: 14, fontSize: 13 }} placeholder="Search lessons..."
                        value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                </div>

                {/* All lessons */}
                <FolderItem label="All Lessons" count={lessons.length} active={activeFolderId === null} onClick={() => setActiveFolderId(null)} />

                {/* Folder tree */}
                {folders.map(f => (
                    <FolderTreeItem 
                        key={f.id} 
                        folder={f} 
                        activeFolderId={activeFolderId} 
                        onSelect={setActiveFolderId} 
                        onDelete={async (id) => {
                            if (confirm('Delete this folder? Lessons inside will not be deleted.')) {
                                await authFetch(`${API}/api/library/folder/${id}`, { method: 'DELETE' });
                                setFolders(folders.filter(folder => folder.id !== id));
                                if (activeFolderId === id) setActiveFolderId(null);
                            }
                        }}
                    />
                ))}

                <div style={{ marginTop: 'auto', paddingTop: 16, borderTop: '1px solid var(--border)' }}>
                    <button className="btn btn-ghost" style={{ width: '100%', justifyContent: 'flex-start', fontSize: 13 }}
                        onClick={() => {
                            const name = prompt('Folder name:');
                            if (name) authFetch(`${API}/api/library/folder`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) })
                                .then(r => r.json()).then(f => setFolders([...folders, { ...f, children: [] }]));
                        }}>
                        + New folder
                    </button>
                </div>
            </aside>

            {/* MAIN AREA */}
            <main style={{ flex: 1, overflowY: 'auto', padding: '24px 32px' }}>
                {/* Due review banner */}
                {dueReviews.length > 0 && (
                    <div style={{ background: 'var(--bg-subtle)', border: '1px solid var(--accent)', borderRadius: 12, padding: '20px 24px', marginBottom: 24, boxShadow: '0 4px 12px rgba(124, 58, 237, 0.1)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                            <div>
                                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>Review Recommendations</h3>
                                <p style={{ margin: '4px 0 0', fontSize: 14, color: 'var(--text-secondary)' }}>
                                    You have <strong style={{ color: 'var(--accent)' }}>{dueReviews.length}</strong> lesson{dueReviews.length > 1 ? 's' : ''} scheduled for review to maximize retention.
                                </p>
                            </div>
                            <button className="btn btn-primary btn-sm" onClick={() => navigate('/lesson')}>Start Reviewing</button>
                        </div>
                        {dueLessons.length > 0 && (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginTop: 16 }}>
                                {dueLessons.slice(0, 3).map((lesson, index) => (
                                    <div key={lesson.id} style={{ background: 'var(--bg-base)', border: '1px solid var(--border)', padding: '12px 16px', borderRadius: 8 }}>
                                        <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{lesson.title || 'Untitled lesson'}</p>
                                        <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--text-tertiary)' }}>Due Today</p>
                                    </div>
                                ))}
                                {dueLessons.length > 3 && (
                                    <div style={{ background: 'var(--bg-muted)', border: '1px dashed var(--border)', padding: '12px 16px', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)' }}>+{dueLessons.length - 3} more lessons</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* Top bar */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
                    <h1 className="text-h1">{activeFolderId ? folders.find(f => f.id === activeFolderId)?.name || 'Library' : 'All Lessons'}</h1>
                    <div style={{ display: 'flex', gap: 8 }}>
                        {(['lessons', 'stats'] as const).map(t => (
                            <button key={t} className={`pill-tab${activeTab === t ? ' active' : ''}`} style={{ flex: 'initial' }}
                                onClick={() => setActiveTab(t)}>{t === 'stats' ? 'Stats' : 'Lessons'}</button>
                        ))}
                    </div>
                </div>

                {loading && <div style={{ color: 'var(--text-tertiary)' }}>Loading...</div>}

                {!loading && activeTab === 'lessons' && (
                    <>
                        {filtered.length === 0 ? (
                            <EmptyState onStart={() => navigate('/')} />
                        ) : (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 }}>
                                {filtered.map(lesson => (
                                    <LessonCard key={lesson.id} lesson={lesson} folders={folders} 
                                        onMoveFolder={async (lessonId: string, folderId: string) => {
                                            await authFetch(`${API}/api/library/lesson/${lessonId}/folder`, { 
                                                method: 'PUT', 
                                                headers: { 'Content-Type': 'application/json' },
                                                body: JSON.stringify({ folder_id: folderId || null }) 
                                            });
                                            setLessons(lessons.map(l => l.id === lessonId ? { ...l, folder_id: folderId || null } : l));
                                        }}
                                        onOpen={() => openLesson(lesson)}
                                        onRetake={() => openAssessment(lesson)}
                                        onViewAttempt={(assessment: any) => viewSavedAssessment(lesson, assessment)}
                                        onExportPDF={exportPDF} onExportMD={() => exportMarkdown(lesson)} onExportAnki={() => exportAnki(lesson)} />
                                ))}
                            </div>
                        )}
                    </>
                )}

                {!loading && activeTab === 'stats' && statsData && <StatsDashboard data={statsData} />}
            </main>
        </div>
    );
}

/* ─── Folder Item ─── */
function FolderItem({ label, count, active, onClick }: { label: string; count: number; active: boolean; onClick: () => void }) {
    return (
        <div onClick={onClick} style={{
            display: 'flex', alignItems: 'center', padding: '6px 10px', borderRadius: 8, cursor: 'pointer', marginBottom: 2,
            background: active ? 'var(--accent-light)' : 'transparent',
            borderLeft: active ? '2px solid var(--accent)' : '2px solid transparent',
            color: active ? 'var(--accent)' : 'var(--text-secondary)',
            fontSize: 13, transition: 'all 150ms ease',
        }}>
            <FolderIcon size={14} style={{ marginRight: 6, opacity: 0.7 }} />
            <span style={{ flex: 1 }}>{label}</span>
            <span className="badge badge-muted" style={{ fontSize: 10 }}>{count}</span>
        </div>
    );
}

/* ─── Recursive Folder Tree ─── */
function FolderTreeItem({ folder, activeFolderId, onSelect, onDelete, depth = 0 }: { folder: Folder; activeFolderId: string | null; onSelect: (id: string) => void; onDelete: (id: string) => void; depth?: number }) {
    const [open, setOpen] = useState(false);
    const [hover, setHover] = useState(false);
    const active = activeFolderId === folder.id;
    return (
        <div onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
            <div onClick={() => { onSelect(folder.id); setOpen(o => !o); }} style={{
                display: 'flex', alignItems: 'center', padding: '6px 10px', paddingLeft: 10 + depth * 16, borderRadius: 8, cursor: 'pointer', marginBottom: 2,
                background: active ? 'var(--accent-light)' : 'transparent',
                borderLeft: active ? '2px solid var(--accent)' : '2px solid transparent',
                color: active ? 'var(--accent)' : 'var(--text-secondary)', fontSize: 13, transition: 'all 150ms ease',
            }}>
                <span style={{ marginRight: 6, display: 'flex', alignItems: 'center' }}>
                    {folder.children?.length > 0 ? (open ? <ChevronDown size={12} /> : <ChevronRight size={12} />) : <Circle size={8} />}
                </span>
                <span style={{ flex: 1 }}>{folder.name}</span>
                {hover && <button className="btn-icon" onClick={(e) => { e.stopPropagation(); onDelete(folder.id); }} style={{ padding: 4 }}><Trash2 size={12} /></button>}
            </div>
            {open && folder.children?.map(child => <FolderTreeItem key={child.id} folder={child} activeFolderId={activeFolderId} onSelect={onSelect} onDelete={onDelete} depth={depth + 1} />)}
        </div>
    );
}

/* ─── Lesson Card ─── */
function LessonCard({ lesson, folders, onMoveFolder, onOpen, onRetake, onViewAttempt, onExportPDF, onExportMD, onExportAnki }: any) {
    const score = lesson.score;
    const scoreBadge = score === null ? 'badge-muted' : score >= 70 ? 'badge-success' : score >= 50 ? 'badge-warning' : 'badge-error';
    const [expanded, setExpanded] = useState(false);
    const [assessments, setAssessments] = useState<any[]>([]);
    const [loadingAssessments, setLoadingAssessments] = useState(false);

    async function toggleExpand(e: React.MouseEvent) {
        e.stopPropagation();
        if (!expanded && assessments.length === 0) {
            setLoadingAssessments(true);
            try {
                const res = await authFetch(`${API}/api/library/lesson/${lesson.id}/assessments`);
                const data = await res.json();
                setAssessments(data.assessments || []);
            } catch (err) { console.warn(err); }
            setLoadingAssessments(false);
        }
        setExpanded(prev => !prev);
    }

    return (
        <div className="card-hover" style={{ padding: 16 }}>
            {/* Header — click to open lesson */}
            <div onClick={onOpen} style={{ cursor: 'pointer' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span className="badge badge-accent">{lesson.domain || 'General'}</span>
                    <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{lesson.date_created?.slice(0, 10) || ''}</span>
                </div>
                <p style={{ fontSize: 14, fontWeight: 500, marginBottom: 10, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {lesson.title}
                </p>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    {score !== null ? <span className={`badge ${scoreBadge}`}>{score}%</span> : <span className="badge badge-muted">No score</span>}
                    <span className="badge badge-muted">{lesson.status || 'complete'}</span>
                </div>
            </div>

            {/* Assessments toggle */}
            <button
                className="btn btn-ghost btn-sm"
                onClick={toggleExpand}
                style={{ width: '100%', marginTop: 10, fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}
            >
                {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                Assessments {assessments.length > 0 && `(${assessments.length})`}
            </button>

            {expanded && (
                <div style={{ marginTop: 8, borderTop: '1px solid var(--border)', paddingTop: 8 }} onClick={e => e.stopPropagation()}>
                    {loadingAssessments ? (
                        <p style={{ fontSize: 12, color: 'var(--text-tertiary)', textAlign: 'center' }}>Loading...</p>
                    ) : assessments.length === 0 ? (
                        <p style={{ fontSize: 12, color: 'var(--text-tertiary)', textAlign: 'center', margin: '8px 0' }}>No assessments yet</p>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 160, overflowY: 'auto' }}>
                            {assessments.map((a: any, i: number) => {
                                const aBadge = a.score >= 70 ? 'badge-success' : a.score >= 50 ? 'badge-warning' : 'badge-error';
                                return (
                                    <div key={a.id} onClick={() => onViewAttempt(a)} style={{
                                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                        padding: '6px 10px', background: 'var(--bg-subtle)', borderRadius: 6,
                                        border: '1px solid var(--border)', fontSize: 12,
                                        cursor: 'pointer', transition: 'background 150ms ease',
                                    }}
                                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--accent-light)')}
                                    onMouseLeave={e => (e.currentTarget.style.background = 'var(--bg-subtle)')}
                                    >
                                        <span style={{ color: 'var(--text-secondary)' }}>
                                            Attempt {assessments.length - i}
                                        </span>
                                        <span style={{ color: 'var(--text-tertiary)' }}>
                                            {a.date_created?.slice(0, 10)}
                                        </span>
                                        <span className={`badge ${aBadge}`} style={{ fontSize: 11 }}>{a.score}%</span>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* New Assessment button */}
                    <button
                        className="btn btn-primary btn-sm"
                        onClick={onRetake}
                        style={{ width: '100%', marginTop: 8, fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}
                    >
                        <RotateCcw size={12} /> New Assessment
                    </button>
                </div>
            )}

            {/* Folder picker */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }} onClick={e => e.stopPropagation()}>
                <select 
                    className="input" 
                    style={{ padding: '4px 8px', fontSize: 11, height: 26, flex: 1 }}
                    value={lesson.folder_id || ''}
                    onChange={e => onMoveFolder(lesson.id, e.target.value)}
                >
                    <option value="">No folder</option>
                    {folders?.map((f: any) => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
            </div>

            {/* Export buttons */}
            <div style={{ marginTop: 8, display: 'flex', gap: 4 }} onClick={e => e.stopPropagation()}>
                <button className="btn btn-ghost btn-sm" onClick={onExportPDF} style={{ fontSize: 11 }}>PDF</button>
                <button className="btn btn-ghost btn-sm" onClick={onExportMD} style={{ fontSize: 11 }}>MD</button>
                <button className="btn btn-ghost btn-sm" onClick={onExportAnki} style={{ fontSize: 11 }}>Anki</button>
            </div>
        </div>
    );
}

/* ─── Stats Dashboard ─── */
function StatsDashboard({ data }: { data: any }) {
    return (
        <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16, marginBottom: 32 }}>
                {[
                    { label: 'Total lessons', value: data.total_lessons },
                    { label: 'Avg score', value: `${Math.round(data.avg_score || 0)}%` },
                    { label: 'Learning time', value: `${Math.round((data.total_time_minutes || 0) / 60 * 10) / 10}h` },
                    { label: 'Best domain', value: data.strongest_domain || '—' },
                ].map(m => (
                    <div key={m.label} className="card-subtle">
                        <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>{m.label}</p>
                        <p style={{ fontSize: 24, fontWeight: 600, color: 'var(--text-primary)' }}>{m.value}</p>
                    </div>
                ))}
            </div>

            {/* Score trend chart */}
            <div style={{ marginBottom: 24 }}>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>Score over time</p>
                <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={data.score_trend || []} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
                        <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                        <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} />
                        <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} />
                        <Tooltip contentStyle={{ background: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
                        <Line type="monotone" dataKey="avg" stroke="var(--accent)" strokeWidth={2} dot={{ fill: 'var(--accent)', r: 3 }} connectNulls />
                    </LineChart>
                </ResponsiveContainer>
            </div>

            {/* Streak */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 500 }}>{data.streak_days || 0} day streak</span>
            </div>
        </div>
    );
}

/* ─── Empty State ─── */
function EmptyState({ onStart }: { onStart: () => void }) {
    return (
        <div style={{ textAlign: 'center', paddingTop: 80 }}>
            <div style={{ width: 80, height: 80, borderRadius: 20, background: 'var(--accent-light)', margin: '0 auto 20px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)' }}>
                <Book size={32} />
            </div>
            <h2 style={{ fontSize: 18, fontWeight: 500, marginBottom: 8 }}>No lessons yet</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: 20 }}>Generate your first lesson to get started</p>
            <button className="btn btn-primary" onClick={onStart}>Start learning</button>
        </div>
    );
}
