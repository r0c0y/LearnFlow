import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useLessonStore } from '../store/lessonStore';
import { useLibraryStore } from '../store/libraryStore';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export default function Navbar() {
    const location = useLocation();
    const navigate = useNavigate();
    const { lessonReady } = useLessonStore();
    const { dueReviews } = useLibraryStore();
    const [dark, setDark] = useState(() => {
        return localStorage.getItem('learnflow-dark') === 'true';
    });
    const [streak, setStreak] = useState(0);

    useEffect(() => {
        const html = document.documentElement;
        if (dark) { html.classList.add('dark'); localStorage.setItem('learnflow-dark', 'true'); }
        else { html.classList.remove('dark'); localStorage.setItem('learnflow-dark', 'false'); }
    }, [dark]);

    useEffect(() => {
        fetch(`${API}/api/stats`).then(r => r.json()).then(d => setStreak(d.streak_days || 0)).catch(() => { });
    }, []);

    const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(path + '/');

    return (
        <nav style={{
            height: 52, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '0 24px',
            background: dark ? 'rgba(12,12,15,0.92)' : 'rgba(255,255,255,0.88)',
            backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
            borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, zIndex: 100,
        }}>
            {/* LEFT — Logo */}
            <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
                <div style={{
                    width: 28, height: 28, borderRadius: 8,
                    background: 'linear-gradient(135deg, #7C3AED 0%, #6D28D9 50%, #4F46E5 100%)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#fff', fontWeight: 700, fontSize: 13, flexShrink: 0,
                    boxShadow: '0 2px 8px rgba(124, 58, 237, 0.3)',
                }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
                        <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
                    </svg>
                </div>
                <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.3px' }}>
                    Learn<span style={{ color: 'var(--accent)' }}>Flow</span>
                </span>
            </Link>

            {/* CENTER — Nav tabs */}
            <div style={{ display: 'flex', gap: 4 }}>
                <NavTab to="/lesson" label="Lesson" active={isActive('/lesson')} />
                <NavTab
                    to="/assessment"
                    label="Assessment"
                    active={isActive('/assessment')}
                    locked={!lessonReady}
                />
                <NavTab to="/library" label="Library" active={isActive('/library')} />
            </div>

            {/* RIGHT — Actions */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {streak > 0 && (
                    <span style={{
                        fontSize: 12, fontWeight: 600, color: 'var(--warning)',
                        background: 'var(--warning-light)', padding: '3px 8px', borderRadius: 6,
                    }}>
                        🔥 {streak}
                    </span>
                )}
                <button
                    className="btn-icon"
                    onClick={() => setDark(d => !d)}
                    aria-label="Toggle dark mode"
                    title={dark ? 'Light mode' : 'Dark mode'}
                >
                    {dark ? <SunIcon /> : <MoonIcon />}
                </button>
                {dueReviews.length > 0 && (
                    <Link to="/library" style={{ textDecoration: 'none' }}>
                        <span className="badge badge-error" style={{ cursor: 'pointer' }}>
                            {dueReviews.length} due
                        </span>
                    </Link>
                )}
            </div>
        </nav>
    );
}

function NavTab({ to, label, active, locked }: { to: string; label: string; active: boolean; locked?: boolean }) {
    const navigate = useNavigate();
    return (
        <button
            onClick={() => !locked && navigate(to)}
            style={{
                padding: '6px 16px', borderRadius: 8, fontSize: 13, fontWeight: 500,
                border: active ? '1px solid var(--border)' : 'none',
                background: active ? 'var(--bg-subtle)' : 'transparent',
                color: locked ? 'var(--text-tertiary)' : active ? 'var(--text-primary)' : 'var(--text-secondary)',
                cursor: locked ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', gap: 4, transition: 'all 150ms ease',
            }}
            disabled={locked}
        >
            {locked && <LockIcon />}
            {label}
        </button>
    );
}

function BookIcon() { return <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /></svg>; }
function MoonIcon() { return <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></svg>; }
function SunIcon() { return <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" /><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" /><line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" /><line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" /></svg>; }
function LockIcon() { return <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>; }
