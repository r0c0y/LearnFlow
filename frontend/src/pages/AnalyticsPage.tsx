import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import { useAuthStore } from '../store/authStore';
import { authFetch } from '../utils/api';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const API = API_BASE.replace(/\/$/, '').replace(/\/api$/, '');

export default function AnalyticsPage() {
    const { token } = useAuthStore();
    const [stats, setStats] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!token) return;
        fetchStats();
    }, [token]);

    async function fetchStats() {
        try {
            const res = await authFetch(`${API}/api/stats`);
            const data = await res.json();
            setStats(data);
        } catch (error) {
            console.error('Failed to fetch stats:', error);
        } finally {
            setLoading(false);
        }
    }

    if (loading) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '50vh', gap: 8, color: 'var(--text-secondary)' }}>
                <span className="animate-spin" style={{ width: 16, height: 16, border: '2px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', display: 'inline-block' }} />
                Loading analytics...
            </div>
        );
    }

    if (!stats) return <div>No data available</div>;

    const scoreTrendData = stats.score_trend || [];
    const domainData = stats.domain_performance || [];

    // Map domain performance to the pie chart
    const pieColors = ['#7C3AED', '#22C55E', '#EAB308', '#EF4444', '#3B82F6'];
    const subjectData = domainData.map((d: any, i: number) => ({
        name: d.name,
        value: d.count,
        color: pieColors[i % pieColors.length]
    }));

    return (
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 32 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
                    <BarChart size={24} />
                </div>
                <h1 className="text-h1" style={{ margin: 0 }}>Learning Analytics</h1>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 20 }}>
                {/* Overview Cards */}
                <div className="card-subtle" style={{ padding: 24 }}>
                    <p style={{ margin: 0, fontSize: 13, color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Lessons</p>
                    <div style={{ fontSize: 36, fontWeight: 800, color: 'var(--text-primary)', marginTop: 8 }}>{stats.total_lessons || 0}</div>
                </div>
                <div className="card-subtle" style={{ padding: 24 }}>
                    <p style={{ margin: 0, fontSize: 13, color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Avg Score</p>
                    <div style={{ fontSize: 36, fontWeight: 800, color: 'var(--success)', marginTop: 8 }}>{Number(stats.avg_score || 0).toFixed(2)}%</div>
                </div>
                <div className="card-subtle" style={{ padding: 24 }}>
                    <p style={{ margin: 0, fontSize: 13, color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Study Streak</p>
                    <div style={{ fontSize: 36, fontWeight: 800, color: 'var(--warning)', marginTop: 8 }}>{stats.streak_days || 0}d</div>
                </div>
                <div className="card-subtle" style={{ padding: 24 }}>
                    <p style={{ margin: 0, fontSize: 13, color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Time Studied</p>
                    <div style={{ fontSize: 36, fontWeight: 800, color: 'var(--info)', marginTop: 8 }}>{Math.round((stats.total_time_minutes || 0) / 60)}h</div>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 24, marginTop: 32 }}>
                {/* Score Progress */}
                <div className="card" style={{ padding: 24 }}>
                    <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 24 }}>Score Trend (Last 7 Days)</h3>
                    <ResponsiveContainer width="100%" height={280}>
                        <LineChart data={scoreTrendData}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                            <XAxis dataKey="date" hide />
                            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--text-tertiary)' }} />
                            <Tooltip contentStyle={{ background: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: 8 }} />
                            <Line type="monotone" dataKey="avg" stroke="var(--accent)" strokeWidth={3} dot={{ r: 4, fill: 'var(--accent)' }} activeDot={{ r: 6 }} connectNulls />
                        </LineChart>
                    </ResponsiveContainer>
                </div>

                {/* Subject Distribution */}
                <div className="card" style={{ padding: 24 }}>
                    <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 24 }}>Library Distribution</h3>
                    {subjectData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={280}>
                            <PieChart>
                                <Pie data={subjectData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value" stroke="none">
                                    {subjectData.map((entry: any, index: number) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Pie>
                                <Tooltip />
                            </PieChart>
                        </ResponsiveContainer>
                    ) : (
                        <div style={{ height: 280, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)' }}>
                            Start saving lessons to see distribution
                        </div>
                    )}
                </div>

                {/* Category Performance */}
                <div className="card" style={{ padding: 24 }}>
                    <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 24 }}>Performance by Folder</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        {domainData.map((d: any, i: number) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                <div style={{ width: 100, fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</div>
                                <div style={{ flex: 1, height: 8, background: 'var(--bg-muted)', borderRadius: 4, overflow: 'hidden' }}>
                                    <div style={{ height: '100%', background: 'var(--accent)', width: `${d.avg}%`, borderRadius: 4 }} />
                                </div>
                                <div style={{ width: 40, fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', textAlign: 'right' }}>{d.avg}%</div>
                            </div>
                        ))}
                        {domainData.length === 0 && <p style={{ color: 'var(--text-tertiary)', textAlign: 'center' }}>No folder data yet</p>}
                    </div>
                </div>

                {/* Domain Insights */}
                <div className="card" style={{ padding: 24, background: 'linear-gradient(135deg, var(--accent-light) 0%, transparent 100%)' }}>
                    <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Learning Insights</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {stats.strongest_domain && (
                            <div style={{ padding: '12px 16px', background: 'var(--bg-base)', borderRadius: 10, border: '1px solid var(--success)' }}>
                                <p style={{ margin: 0, fontSize: 12, color: 'var(--success)', fontWeight: 700, textTransform: 'uppercase' }}>Strongest Area</p>
                                <p style={{ margin: '4px 0 0', fontSize: 15, fontWeight: 600 }}>{stats.strongest_domain}</p>
                            </div>
                        )}
                        {stats.weakest_domain && stats.weakest_domain !== stats.strongest_domain && (
                            <div style={{ padding: '12px 16px', background: 'var(--bg-base)', borderRadius: 10, border: '1px solid var(--error)' }}>
                                <p style={{ margin: 0, fontSize: 12, color: 'var(--error)', fontWeight: 700, textTransform: 'uppercase' }}>Review Recommended</p>
                                <p style={{ margin: '4px 0 0', fontSize: 15, fontWeight: 600 }}>{stats.weakest_domain}</p>
                            </div>
                        )}
                        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 8, lineHeight: 1.5 }}>
                            Keep up the momentum! Your average score is higher than 75% of users this week. 
                            Consider spending 15 mins tomorrow on <strong>{stats.weakest_domain || 'your recent lessons'}</strong> to solidify your understanding.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}