import express from "express";
import { db } from "../db/client.js";
import { getGroq, FAST_MODEL } from "../services/groq.js";

const router = express.Router();

// GET /api/lesson/:id — fetch lesson from Turso
router.get("/:id", async (req, res) => {
    try {
        const { rows } = await db.execute({
            sql: "SELECT * FROM lessons WHERE id = ?",
            args: [req.params.id],
        });
        if (!rows.length) return res.status(404).json({ error: "Lesson not found" });
        const lesson = rows[0];
        res.json({
            ...lesson,
            content_json: JSON.parse(lesson.content_json || "null"),
            blueprint_json: JSON.parse(lesson.blueprint_json || "null"),
            assessment_json: JSON.parse(lesson.assessment_json || "null"),
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/lesson/branch — rewrite or extend a single section
router.post("/branch", async (req, res) => {
    const { section_id, type, section_content, lesson_title } = req.body;
    const isRewrite = type === "rewrite";

    const systemPrompt = isRewrite
        ? `You are a master educator. Rewrite the following lesson section using a completely different explanation approach, fresh analogies, and a new perspective. Keep the same learning objective. Return JSON: {"title": "...", "content": "...", "analogy": "...", "example": "..."}`
        : `You are a master educator. Generate ONE additional worked example for the concept below. The example should be concrete, step-by-step, and different from examples already shown. Return JSON: {"title": "...", "example_setup": "...", "code": "...", "explanation": "..."}`;

    try {
        for (let attempt = 0; attempt < 3; attempt++) {
            try {
                const res2 = await getGroq().chat.completions.create({
                    model: FAST_MODEL,
                    max_tokens: 1500,
                    response_format: { type: "json_object" },
                    messages: [
                        { role: "system", content: systemPrompt },
                        { role: "user", content: `Lesson: ${lesson_title}\nSection ${section_id}:\n${JSON.stringify(section_content)}` },
                    ],
                });
                const newSection = JSON.parse(res2.choices[0].message.content);
                return res.json({ section_id, type, new_content: newSection });
            } catch (e) {
                if (e.status === 429 && attempt < 2) {
                    await new Promise((r) => setTimeout(r, Math.pow(2, attempt) * 1000));
                    continue;
                }
                throw e;
            }
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
