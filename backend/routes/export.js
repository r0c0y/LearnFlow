import express from "express";
import { db } from "../db/client.js";
import axios from "axios";

const router = express.Router();

// GET /api/reviews/due — lessons due for spaced repetition review
router.get("/due", async (req, res) => {
    try {
        const { rows } = await db.execute(`
      SELECT r.*, l.title, l.content_json
      FROM reviews r
      JOIN lessons l ON r.lesson_id = l.id
      WHERE r.review_date <= date('now')
      ORDER BY r.review_date ASC
    `);
        res.json({ due: rows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/export/anki — generate Anki deck via Python service
router.post("/anki", async (req, res) => {
    const { lesson_id } = req.body;
    try {
        const { data: lessonData } = await db.execute({
            sql: "SELECT * FROM lessons WHERE id = ?",
            args: [lesson_id],
        });

        const agentRes = await axios.post(
            `${process.env.AGENT_SERVICE_URL}/export/anki`,
            { lesson_id, lesson: lessonData?.rows?.[0] },
            { responseType: "arraybuffer" }
        );

        res.set("Content-Type", "application/octet-stream");
        res.set("Content-Disposition", `attachment; filename="learnflow_${lesson_id}.apkg"`);
        res.send(agentRes.data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
