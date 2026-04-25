import express from "express";
import { db } from "../db/client.js";
import axios from "axios";
import { v4 as uuidv4 } from "uuid";

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
        const { rows } = await db.execute({
            sql: "SELECT * FROM lessons WHERE id = ?",
            args: [lesson_id],
        });

        if (!rows?.length) return res.status(404).json({ error: "Lesson not found" });

        const agentRes = await axios.post(
            `${process.env.AGENT_SERVICE_URL}/export/anki`,
            { lesson_id, lesson: rows[0] },
            { responseType: "arraybuffer" }
        );

        res.set("Content-Type", "application/octet-stream");
        res.set("Content-Disposition", `attachment; filename="learnflow_${lesson_id}.apkg"`);
        res.send(agentRes.data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/reviews/schedule — schedule a spaced repetition review
router.post("/schedule", async (req, res) => {
    const { lesson_id, review_date, score } = req.body;
    if (!lesson_id || !review_date) return res.status(400).json({ error: "lesson_id and review_date required" });
    try {
        const id = uuidv4();
        await db.execute({
            sql: "INSERT INTO reviews (id, lesson_id, review_date, score) VALUES (?,?,?,?)",
            args: [id, lesson_id, review_date, score || 0],
        });
        res.json({ id, scheduled: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
