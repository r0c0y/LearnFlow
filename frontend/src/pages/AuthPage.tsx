import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

const API = import.meta.env.VITE_API_URL || '';

export default function AuthPage() {
    const navigate = useNavigate();
    const { user, setAuth } = useAuthStore();
    const [mode, setMode] = useState<'login' | 'register'>('login');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (user) {
            navigate('/library');
        }
    }, [user]);

    async function handleSubmit(e: any) {
        e.preventDefault();
        setError(null);
        setLoading(true);

        try {
            const res = await fetch(`${API}/api/auth/${mode}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            });
            const data = await res.json();
            if (!res.ok || data.error) {
                setError(data.error || 'Authentication failed');
            } else {
                setAuth(data.token, data.user);
                navigate('/library');
            }
        } catch (err: any) {
            setError(err.message || 'Authentication failed');
        } finally {
            setLoading(false);
        }
    }

    return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
            <div style={{ width: 420, padding: 32, borderRadius: 24, background: 'var(--bg-base)', boxShadow: '0 24px 80px rgba(15, 23, 42, 0.08)' }}>
                <h1 className="text-h1" style={{ marginBottom: 12 }}>{mode === 'login' ? 'Welcome back' : 'Create your account'}</h1>
                <p style={{ color: 'var(--text-secondary)', marginBottom: 24 }}>Sign in to save lessons, view your library, and keep your progress.</p>

                <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
                    {(['login', 'register'] as const).map((option) => (
                        <button key={option}
                            className={`pill-tab${mode === option ? ' active' : ''}`}
                            style={{ flex: 1, padding: '10px 14px' }}
                            onClick={() => setMode(option)}>
                            {option === 'login' ? 'Login' : 'Register'}
                        </button>
                    ))}
                </div>

                <form onSubmit={handleSubmit}>
                    <label style={{ display: 'block', marginBottom: 12, fontSize: 13, color: 'var(--text-secondary)' }}>
                        Email
                        <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} style={{ marginTop: 8, width: '100%' }} required />
                    </label>
                    <label style={{ display: 'block', marginBottom: 20, fontSize: 13, color: 'var(--text-secondary)' }}>
                        Password
                        <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} style={{ marginTop: 8, width: '100%' }} required />
                    </label>
                    {error && <div style={{ color: 'var(--error)', marginBottom: 16 }}>{error}</div>}
                    <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
                        {loading ? 'Working...' : mode === 'login' ? 'Log in' : 'Create account'}
                    </button>
                </form>
            </div>
        </div>
    );
}
