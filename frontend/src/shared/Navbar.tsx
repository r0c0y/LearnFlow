import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useLessonStore } from '../store/lessonStore';
import { useLibraryStore } from '../store/libraryStore';
import { useAuthStore } from '../store/authStore';
import { authFetch } from '../utils/api';
import { Book, Moon, Sun, Lock } from 'lucide-react';

const API = import.meta.env.VITE_API_URL || '';

export default function Navbar() {
    const location = useLocation();
    const navigate = useNavigate();
    const { lessonReady } = useLessonStore();
    const { dueReviews } = useLibraryStore();
    const { user, clearAuth } = useAuthStore();
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
        if (user) {
            authFetch(`${API}/api/stats`).then(r => r.json()).then(d => setStreak(d.streak_days || 0)).catch(() => { });
        } else {
            setStreak(0);
        }
    }, [user]);

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
                <NavTab to="/analytics" label="Analytics" active={isActive('/analytics')} />
            </div>

            {/* RIGHT — Actions */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {streak > 0 && (
                    <span style={{
                        fontSize: 12, fontWeight: 600, color: 'var(--warning)',
                        background: 'var(--warning-light)', padding: '3px 8px', borderRadius: 6,
                    }}>
                        {streak} day streak
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
                {user ? (
                    <>
                        <span style={{ fontSize: 12, color: 'var(--text-secondary)', padding: '4px 10px', borderRadius: 999, background: 'var(--bg-muted)' }}>
                            {user.email}
                        </span>
                        <button className="btn btn-ghost" style={{ fontSize: 12, padding: '8px 12px' }} onClick={() => { clearAuth(); navigate('/auth'); }}>
                            Logout
                        </button>
                    </>
                ) : (
                    <button className="btn btn-primary btn-sm" style={{ fontSize: 12, padding: '8px 12px' }} onClick={() => navigate('/auth')}>
                        Login
                    </button>
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

function BookIcon() { return <Book size={16} />; }
function MoonIcon() { return <Moon size={16} />; }
function SunIcon() { return <Sun size={16} />; }
function LockIcon() { return <Lock size={12} />; }
