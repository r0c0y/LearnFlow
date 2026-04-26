import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import { useAuthStore } from '../store/authStore';
import { authFetch } from '../utils/api';

const API = '';

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

    const scoreData = [
        { name: 'Beginner', score: 65 },
        { name: 'Intermediate', score: 78 },
        { name: 'Advanced', score: 85 },
    ];

    const timeData = [
        { day: 'Mon', minutes: 45 },
        { day: 'Tue', minutes: 60 },
        { day: 'Wed', minutes: 30 },
        { day: 'Thu', minutes: 75 },
        { day: 'Fri', minutes: 50 },
        { day: 'Sat', minutes: 90 },
        { day: 'Sun', minutes: 40 },
    ];

    const subjectData = [
        { name: 'Math', value: 35, color: '#8884d8' },
        { name: 'Science', value: 25, color: '#82ca9d' },
        { name: 'History', value: 20, color: '#ffc658' },
        { name: 'Language', value: 20, color: '#ff7c7c' },
    ];

    return (
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 24px' }}>
            <h1 className="text-h1" style={{ marginBottom: 32 }}>Learning Analytics</h1>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 24 }}>
                {/* Overview Cards */}
                <div className="card">
                    <h3 style={{ marginBottom: 8 }}>Total Lessons</h3>
                    <div style={{ fontSize: 32, fontWeight: 700, color: 'var(--accent)' }}>{stats.total_lessons || 0}</div>
                </div>
                <div className="card">
                    <h3 style={{ marginBottom: 8 }}>Average Score</h3>
                    <div style={{ fontSize: 32, fontWeight: 700, color: 'var(--success)' }}>{stats.avg_score || 0}%</div>
                </div>
                <div className="card">
                    <h3 style={{ marginBottom: 8 }}>Study Streak</h3>
                    <div style={{ fontSize: 32, fontWeight: 700, color: 'var(--warning)' }}>{stats.streak_days || 0} days</div>
                </div>
                <div className="card">
                    <h3 style={{ marginBottom: 8 }}>Time Studied</h3>
                    <div style={{ fontSize: 32, fontWeight: 700, color: 'var(--info)' }}>{Math.round((stats.total_time_minutes || 0) / 60)}h</div>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 24, marginTop: 32 }}>
                {/* Score Progress */}
                <div className="card">
                    <h3 style={{ marginBottom: 16 }}>Score by Difficulty</h3>
                    <ResponsiveContainer width="100%" height={250}>
                        <BarChart data={scoreData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" />
                            <YAxis />
                            <Tooltip />
                            <Bar dataKey="score" fill="var(--accent)" />
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                {/* Study Time */}
                <div className="card">
                    <h3 style={{ marginBottom: 16 }}>Daily Study Time</h3>
                    <ResponsiveContainer width="100%" height={250}>
                        <LineChart data={timeData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="day" />
                            <YAxis />
                            <Tooltip />
                            <Line type="monotone" dataKey="minutes" stroke="var(--accent)" strokeWidth={2} />
                        </LineChart>
                    </ResponsiveContainer>
                </div>

                {/* Subject Distribution */}
                <div className="card">
                    <h3 style={{ marginBottom: 16 }}>Subjects Studied</h3>
                    <ResponsiveContainer width="100%" height={250}>
                        <PieChart>
                            <Pie data={subjectData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label>
                                {subjectData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                            </Pie>
                            <Tooltip />
                        </PieChart>
                    </ResponsiveContainer>
                </div>

                {/* Recent Activity */}
                <div className="card">
                    <h3 style={{ marginBottom: 16 }}>Recent Activity</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span>Completed "Algebra Basics"</span>
                            <span className="badge badge-success">85%</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span>Reviewed "Chemistry Reactions"</span>
                            <span className="badge badge-warning">70%</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span>Started "World History"</span>
                            <span className="badge badge-muted">In Progress</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}