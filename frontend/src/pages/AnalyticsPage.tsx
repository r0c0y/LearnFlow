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

    const isDemo = scoreTrendData.some((p: any) => p.isDemo);

    return (
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
                        <BarChart size={24} />
                    </div>
                    <h1 className="text-h1" style={{ margin: 0 }}>Learning Analytics</h1>
                </div>
                {isDemo && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(124,58,237,0.1)', padding: '6px 12px', borderRadius: 20, border: '1px solid var(--accent)' }}>
                        <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', animation: 'pulse 2s infinite' }} />
                        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent)' }}>Preview Data</span>
                    </div>
                )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 20 }}>
                {/* Overview Cards */}
                <div className="card-subtle" style={{ padding: 24, position: 'relative', overflow: 'hidden' }}>
                    <div style={{ position: 'absolute', right: -10, top: -10, opacity: 0.05 }}><Check size={80} /></div>
                    <p style={{ margin: 0, fontSize: 13, color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Lessons</p>
                    <div style={{ fontSize: 36, fontWeight: 800, color: 'var(--text-primary)', marginTop: 8 }}>{stats.total_lessons || 0}</div>
                </div>
                <div className="card-subtle" style={{ padding: 24, position: 'relative', overflow: 'hidden' }}>
                    <div style={{ position: 'absolute', right: -10, top: -10, opacity: 0.05 }}><PieChart size={80} /></div>
                    <p style={{ margin: 0, fontSize: 13, color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Avg Score</p>
                    <div style={{ fontSize: 36, fontWeight: 800, color: 'var(--success)', marginTop: 8 }}>{Number(stats.avg_score || 0).toFixed(2)}%</div>
                </div>
                <div className="card-subtle" style={{ padding: 24, position: 'relative', overflow: 'hidden' }}>
                    <div style={{ position: 'absolute', right: -10, top: -10, opacity: 0.05 }}><LineChart size={80} /></div>
                    <p style={{ margin: 0, fontSize: 13, color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Study Streak</p>
                    <div style={{ fontSize: 36, fontWeight: 800, color: 'var(--warning)', marginTop: 8 }}>{stats.streak_days || 0}d</div>
                </div>
                <div className="card-subtle" style={{ padding: 24, position: 'relative', overflow: 'hidden' }}>
                    <div style={{ position: 'absolute', right: -10, top: -10, opacity: 0.05 }}><BarChart size={80} /></div>
                    <p style={{ margin: 0, fontSize: 13, color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Time Studied</p>
                    <div style={{ fontSize: 36, fontWeight: 800, color: 'var(--info)', marginTop: 8 }}>{Math.round((stats.total_time_minutes || 0) / 60)}h</div>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 24, marginTop: 32 }}>
                {/* Score Progress */}
                <div className="card" style={{ padding: 24 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                        <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Score Trend</h3>
                        <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase' }}>Last 7 Days</span>
                    </div>
                    <ResponsiveContainer width="100%" height={280}>
                        <LineChart data={scoreTrendData} margin={{ left: -20, right: 10 }}>
                            <defs>
                                <linearGradient id="lineGradient" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.1}/>
                                    <stop offset="95%" stopColor="var(--accent)" stopOpacity={0}/>
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                            <XAxis 
                                dataKey="date" 
                                tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }} 
                                axisLine={false} 
                                tickLine={false} 
                                tickFormatter={(str) => {
                                    if (!str) return '';
                                    const d = new Date(str);
                                    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
                                }}
                                minTickGap={30}
                            />
                            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--text-tertiary)' }} domain={[0, 100]} />
                            <Tooltip contentStyle={{ background: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                            <Line type="monotone" dataKey="avg" stroke="var(--accent)" strokeWidth={3} dot={{ r: 4, fill: 'var(--bg-base)', stroke: 'var(--accent)', strokeWidth: 2 }} activeDot={{ r: 6, strokeWidth: 0 }} connectNulls />
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
                                <Tooltip contentStyle={{ borderRadius: 8 }} />
                            </PieChart>
                        </ResponsiveContainer>
                    ) : (
                        <div style={{ height: 280, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)', background: 'var(--bg-subtle)', borderRadius: 12, border: '1px dashed var(--border)' }}>
                            <p style={{ textAlign: 'center', fontSize: 13 }}>Start saving lessons to see distribution</p>
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
                                <div style={{ flex: 1, height: 6, background: 'var(--bg-muted)', borderRadius: 3, overflow: 'hidden' }}>
                                    <div style={{ height: '100%', background: 'var(--accent)', width: `${d.avg}%`, borderRadius: 3 }} />
                                </div>
                                <div style={{ width: 40, fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', textAlign: 'right' }}>{d.avg}%</div>
                            </div>
                        ))}
                        {domainData.length === 0 && <p style={{ color: 'var(--text-tertiary)', textAlign: 'center', fontSize: 13, marginTop: 40 }}>No folder data yet</p>}
                    </div>
                </div>

                {/* Domain Insights */}
                <div className="card" style={{ padding: 24, background: 'linear-gradient(135deg, var(--accent-light) 0%, transparent 100%)', border: '1px solid var(--accent)' }}>
                    <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Learning Insights</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {stats.strongest_domain && (
                            <div style={{ padding: '14px', background: 'var(--bg-base)', borderRadius: 12, border: '1px solid var(--success)', display: 'flex', alignItems: 'center', gap: 12 }}>
                                <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--success-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--success)' }}>✓</div>
                                <div>
                                    <p style={{ margin: 0, fontSize: 11, color: 'var(--success)', fontWeight: 700, textTransform: 'uppercase' }}>Strongest Area</p>
                                    <p style={{ margin: '2px 0 0', fontSize: 15, fontWeight: 600 }}>{stats.strongest_domain}</p>
                                </div>
                            </div>
                        )}
                        {stats.weakest_domain && stats.weakest_domain !== stats.strongest_domain && (
                            <div style={{ padding: '14px', background: 'var(--bg-base)', borderRadius: 12, border: '1px solid var(--error)', display: 'flex', alignItems: 'center', gap: 12 }}>
                                <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--error-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--error)' }}>!</div>
                                <div>
                                    <p style={{ margin: 0, fontSize: 11, color: 'var(--error)', fontWeight: 700, textTransform: 'uppercase' }}>Review Recommended</p>
                                    <p style={{ margin: '2px 0 0', fontSize: 15, fontWeight: 600 }}>{stats.weakest_domain}</p>
                                </div>
                            </div>
                        )}
                        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 8, lineHeight: 1.6 }}>
                            {isDemo ? "This is a preview of how your analytics will look once you complete more lessons. We'll track your accuracy and study patterns in real-time." : "Keep up the momentum! Your average score is higher than 75% of users this week. Consider spending 15 mins tomorrow to solidify your understanding."}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}