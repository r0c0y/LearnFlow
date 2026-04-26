import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip } from 'recharts';
import { useLibraryStore } from '../store/libraryStore';
import type { SavedLesson, Folder } from '../store/libraryStore';
import { useLessonStore } from '../store/lessonStore';
import { useAuthStore } from '../store/authStore';
import { authFetch } from '../utils/api';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

const API = import.meta.env.VITE_API_URL || '';

export default function LibraryPage() {
    const navigate = useNavigate();
    const { lessons, folders, activeFolderId, setLessons, setFolders, setActiveFolderId, dueReviews, setDueReviews, statsData, setStatsData, searchQuery, setSearchQuery } = useLibraryStore();
    const { setLessons: setCurrentLessons, setLessonReady } = useLessonStore();
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
            fetch(`${API}/api/stats`).then(r => r.json()),
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

    async function openLesson(lesson: SavedLesson) {
        const content = lesson.content_json;
        if (Array.isArray(content)) { setCurrentLessons(content); }
        else if (content) { setCurrentLessons([content]); }
        setLessonReady(true);
        navigate('/lesson');
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
                {folders.map(f => <FolderTreeItem key={f.id} folder={f} activeFolderId={activeFolderId} onSelect={setActiveFolderId} />)}

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
                    <div style={{ background: 'var(--warning-light)', border: '1px solid #FCD34D', borderRadius: 10, padding: '14px 18px', marginBottom: 20 }}>
                        <p style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>Review recommendations</p>
                        <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--text-secondary)' }}>
                            You have <strong>{dueReviews.length}</strong> lesson{dueReviews.length > 1 ? 's' : ''} due for review today.
                        </p>
                        {dueLessons.length > 0 && (
                            <ul style={{ margin: '10px 0 0', paddingLeft: 18, color: 'var(--text-secondary)', fontSize: 13 }}>
                                {dueLessons.slice(0, 3).map((lesson, index) => (
                                    <li key={lesson.id}>{lesson.title || 'Untitled lesson'}{index === 2 && dueLessons.length > 3 ? ` and ${dueLessons.length - 3} more` : ''}</li>
                                ))}
                            </ul>
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
                                    <LessonCard key={lesson.id} lesson={lesson} onOpen={() => openLesson(lesson)}
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
            <span style={{ marginRight: 6 }}>📁</span>
            <span style={{ flex: 1 }}>{label}</span>
            <span className="badge badge-muted" style={{ fontSize: 10 }}>{count}</span>
        </div>
    );
}

/* ─── Recursive Folder Tree ─── */
function FolderTreeItem({ folder, activeFolderId, onSelect, depth = 0 }: { folder: Folder; activeFolderId: string | null; onSelect: (id: string) => void; depth?: number }) {
    const [open, setOpen] = useState(false);
    const active = activeFolderId === folder.id;
    return (
        <div>
            <div onClick={() => { onSelect(folder.id); setOpen(o => !o); }} style={{
                display: 'flex', alignItems: 'center', padding: '6px 10px', paddingLeft: 10 + depth * 16, borderRadius: 8, cursor: 'pointer', marginBottom: 2,
                background: active ? 'var(--accent-light)' : 'transparent',
                borderLeft: active ? '2px solid var(--accent)' : '2px solid transparent',
                color: active ? 'var(--accent)' : 'var(--text-secondary)', fontSize: 13, transition: 'all 150ms ease',
            }}>
                <span style={{ marginRight: 6, fontSize: 10 }}>{folder.children?.length > 0 ? (open ? '▼' : '▶') : '○'}</span>
                <span style={{ flex: 1 }}>{folder.name}</span>
            </div>
            {open && folder.children?.map(child => <FolderTreeItem key={child.id} folder={child} activeFolderId={activeFolderId} onSelect={onSelect} depth={depth + 1} />)}
        </div>
    );
}

/* ─── Lesson Card ─── */
function LessonCard({ lesson, onOpen, onExportPDF, onExportMD, onExportAnki }: any) {
    const score = lesson.score;
    const scoreBadge = score === null ? 'badge-muted' : score >= 70 ? 'badge-success' : score >= 50 ? 'badge-warning' : 'badge-error';
    const [showExport, setShowExport] = useState(false);

    return (
        <div className="card-hover" style={{ padding: 16 }} onClick={onOpen}>
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
            {/* Export options */}
            <div style={{ marginTop: 10, display: 'flex', gap: 4 }} onClick={e => e.stopPropagation()}>
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
            <div style={{ width: 80, height: 80, borderRadius: 20, background: 'var(--accent-light)', margin: '0 auto 20px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, color: 'var(--text-secondary)' }}>Library</div>
            <h2 style={{ fontSize: 18, fontWeight: 500, marginBottom: 8 }}>No lessons yet</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: 20 }}>Generate your first lesson to get started</p>
            <button className="btn btn-primary" onClick={onStart}>Start learning</button>
        </div>
    );
}
