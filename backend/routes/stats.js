import express from "express";
import { db } from "../db/client.js";

const router = express.Router();

// GET /api/stats — aggregate learning statistics
router.get("/", async (req, res) => {
    try {
        const { rows: statsRows } = await db.execute("SELECT * FROM stats WHERE id = 1");
        const stats = statsRows[0] || {};

        const { rows: lessonRows } = await db.execute(`
      SELECT l.score, f.name as folder_name,
             strftime('%Y-%m-%d', l.date_assessed) as day
      FROM lessons l
      LEFT JOIN lesson_folders lf ON l.id = lf.lesson_id
      LEFT JOIN folders f ON lf.folder_id = f.id
      WHERE l.score IS NOT NULL
    `);

        // Score trend last 7 days
        const today = new Date();
        const trendMap = {};
        for (let i = 6; i >= 0; i--) {
            const d = new Date(today);
            d.setDate(d.getDate() - i);
            const key = d.toISOString().split("T")[0];
            trendMap[key] = { date: key, avg: null, count: 0, sum: 0 };
        }
        lessonRows.forEach((r) => {
            if (r.day && trendMap[r.day] !== undefined) {
                trendMap[r.day].sum += r.score || 0;
                trendMap[r.day].count++;
            }
        });
        const scoreTrend = Object.values(trendMap).map((d) => ({
            date: d.date,
            avg: d.count > 0 ? Math.round(d.sum / d.count) : null,
        }));

        // Domain performance
        const domainMap = {};
        lessonRows.forEach((r) => {
            const domain = r.folder_name || "Uncategorized";
            if (!domainMap[domain]) domainMap[domain] = { sum: 0, count: 0 };
            domainMap[domain].sum += r.score || 0;
            domainMap[domain].count++;
        });
        const domainPerf = Object.entries(domainMap).map(([name, d]) => ({
            name,
            avg: Math.round(d.sum / d.count),
            count: d.count,
        }));
        domainPerf.sort((a, b) => b.avg - a.avg);

        res.json({
            total_lessons: stats.total_lessons || 0,
            avg_score: stats.avg_score || 0,
            total_time_minutes: stats.total_time_minutes || 0,
            streak_days: stats.streak_days || 0,
            score_trend: scoreTrend,
            domain_performance: domainPerf,
            strongest_domain: domainPerf[0]?.name || null,
            weakest_domain: domainPerf[domainPerf.length - 1]?.name || null,
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
