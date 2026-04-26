import express from "express";
import { db } from "../db/client.js";
import { getGroq, FAST_MODEL } from "../services/groq.js";
import { v4 as uuidv4 } from "uuid";
import { authenticate } from "../middleware/auth.js";

const router = express.Router();
router.use(authenticate);

// GET /api/library — all lessons + folder tree
router.get("/", async (req, res) => {
    try {
        const userId = req.user.id;
        let { rows: lessons } = await db.execute({
            sql: `SELECT l.*, lf.folder_id
      FROM lessons l
      LEFT JOIN lesson_folders lf ON l.id = lf.lesson_id
      WHERE l.user_id = ?
      ORDER BY l.date_created DESC`,
            args: [userId],
        });

        if (lessons.length === 0) {
            // Seed fake lessons for demo
            const fakeLessons = [
                { id: `demo_1_${userId}`, title: "Introduction to Financial Markets", domain: "Finance", folder_id: "finance_default", score: 92, content_json: JSON.stringify({ explanation: "Markets are systems where buyers and sellers interact." }) },
                { id: `demo_2_${userId}`, title: "Python Data Structures", domain: "Tech", folder_id: "tech_default", score: 85, content_json: JSON.stringify({ explanation: "Lists and dictionaries form the foundation of Python data." }) },
                { id: `demo_3_${userId}`, title: "Basic Quantum Mechanics", domain: "Science", folder_id: "science_default", score: 78, content_json: JSON.stringify({ explanation: "Particles can exist in multiple states simultaneously." }) },
                { id: `demo_4_${userId}`, title: "Spanish Conversation Basics", domain: "Language", folder_id: "language_default", score: 88, content_json: JSON.stringify({ explanation: "Basic greetings and introductions in Spanish." }) }
            ];

            for (const l of fakeLessons) {
                await db.execute({
                    sql: `INSERT OR REPLACE INTO lessons (id, title, domain, content_json, score, date_created, status, user_id) VALUES (?,?,?,?,?,?,?,?)`,
                    args: [l.id, l.title, l.domain, l.content_json, l.score, new Date().toISOString(), "complete", userId]
                });
                await db.execute({
                    sql: "INSERT OR IGNORE INTO lesson_folders (lesson_id, folder_id) VALUES (?,?)",
                    args: [l.id, l.folder_id]
                });
            }

            const { rows: updatedLessons } = await db.execute({
                sql: `SELECT l.*, lf.folder_id FROM lessons l LEFT JOIN lesson_folders lf ON l.id = lf.lesson_id WHERE l.user_id = ? ORDER BY l.date_created DESC`,
                args: [userId],
            });
            lessons = updatedLessons;
        }
        const { rows: folders } = await db.execute("SELECT * FROM folders ORDER BY name");

        // Build folder tree
        const folderMap = {};
        folders.forEach((f) => { folderMap[f.id] = { ...f, children: [] }; });
        const rootFolders = [];
        folders.forEach((f) => {
            if (f.parent_id && folderMap[f.parent_id]) {
                folderMap[f.parent_id].children.push(folderMap[f.id]);
            } else {
                rootFolders.push(folderMap[f.id]);
            }
        });

        res.json({
            lessons: lessons.map((l) => ({
                ...l,
                content_json: l.content_json ? JSON.parse(l.content_json) : null,
                assessment_json: l.assessment_json ? JSON.parse(l.assessment_json) : null,
            })),
            folders: rootFolders,
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/save — save lesson, AI auto-suggests folder
router.post("/save", async (req, res) => {
    const { lesson, folder_id } = req.body;
    const userId = req.user.id;
    console.log(`[SAVE] User ${userId} saving lesson: ${lesson?.title || 'untitled'}, id=${lesson?.id || 'new'}, score=${lesson?.score}`);
    if (!lesson) {
        return res.status(400).json({ error: "Missing lesson data" });
    }
    try {
        const id = lesson.id || uuidv4();

        // AI folder suggestion if not provided
        let suggestedFolder = folder_id;
        let suggestion = null;
        if (!folder_id) {
            try {
                const result = await getGroq().chat.completions.create({
                    model: FAST_MODEL,
                    max_tokens: 100,
                    response_format: { type: "json_object" },
                    messages: [
                        { role: "system", content: 'You are a librarian. Based on the lesson title and content snippet, suggest the best folder from: Tech, Finance, Language, Science, Uncategorized. Return JSON: {"folder": "Tech", "reason": "one sentence"}' },
                        { role: "user", content: `Title: ${lesson.title}\nContent: ${JSON.stringify(lesson.content_json || "").slice(0, 200)}` },
                    ],
                });
                const parsed = JSON.parse(result.choices[0].message.content);
                suggestion = parsed;
                suggestedFolder = parsed.folder?.toLowerCase().replace(/ /g, "_") + "_default";
            } catch (err) {
                console.error("Groq categorization failed, defaulting to Uncategorized", err);
                suggestedFolder = "uncategorized_default";
            }
        }

        await db.execute({
            sql: `INSERT OR REPLACE INTO lessons
            (id, title, domain, subdomain, content_json, blueprint_json, assessment_json, score, date_created, date_assessed, iterations_needed, status, user_id)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
            args: [
                id, lesson.title, lesson.domain || null, lesson.subdomain || null,
                JSON.stringify(lesson.content_json || null),
                JSON.stringify(lesson.blueprint_json || null),
                JSON.stringify(lesson.assessment_json || null),
                lesson.score != null ? lesson.score : null,
                lesson.date_created || new Date().toISOString(),
                lesson.date_assessed || null,
                lesson.iterations_needed || 0,
                lesson.status || "complete",
                userId,
            ],
        });

        if (suggestedFolder) {
            await db.execute({
                sql: "INSERT OR IGNORE INTO lesson_folders (lesson_id, folder_id) VALUES (?,?)",
                args: [id, suggestedFolder],
            });
        }

        // Update stats
        await db.execute({
            sql: `
              INSERT INTO stats (user_id, total_lessons, last_active) VALUES (?, 1, date('now'))
              ON CONFLICT(user_id) DO UPDATE SET
                total_lessons = total_lessons + 1,
                last_active = date('now'),
                streak_days = CASE
                  WHEN last_active = date('now', '-1 day') THEN streak_days + 1
                  WHEN last_active = date('now') THEN streak_days
                  ELSE 1
                END
            `,
            args: [userId]
        });

        res.json({ id, saved: true, suggestion });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/library/folder — create folder
router.post("/folder", async (req, res) => {
    const { name, parent_id } = req.body;
    const id = uuidv4();
    try {
        await db.execute({
            sql: "INSERT INTO folders (id, name, parent_id, created_at) VALUES (?,?,?,?)",
            args: [id, name, parent_id || null, new Date().toISOString()],
        });
        res.json({ id, name, parent_id });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/library/folder/:id
router.delete("/folder/:id", async (req, res) => {
    try {
        await db.execute({ sql: "DELETE FROM folders WHERE id = ?", args: [req.params.id] });
        res.json({ deleted: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT /api/library/lesson/:id/folder — move lesson
router.put("/lesson/:id/folder", async (req, res) => {
    const { folder_id } = req.body;
    try {
        await db.execute({
            sql: "DELETE FROM lesson_folders WHERE lesson_id = ?",
            args: [req.params.id]
        });
        if (folder_id) {
            await db.execute({
                sql: "INSERT INTO lesson_folders (lesson_id, folder_id) VALUES (?,?)",
                args: [req.params.id, folder_id]
            });
        }
        res.json({ moved: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/library/assessment — save an assessment attempt
router.post("/assessment", async (req, res) => {
    const userId = req.user.id;
    const { lesson_id, questions, answers, score_report, score } = req.body;
    const id = uuidv4();
    console.log(`[ASSESSMENT] User ${userId} saving assessment for lesson ${lesson_id}, score=${score}`);
    try {
        await db.execute({
            sql: `INSERT INTO assessments (id, lesson_id, user_id, questions_json, answers_json, score_report_json, score, date_created)
                  VALUES (?,?,?,?,?,?,?,?)`,
            args: [
                id, lesson_id, userId,
                JSON.stringify(questions || []),
                JSON.stringify(answers || {}),
                JSON.stringify(score_report || {}),
                score != null ? score : 0,
                new Date().toISOString()
            ]
        });

        // Also update the lesson's latest score
        await db.execute({
            sql: `UPDATE lessons SET score = ?, date_assessed = ? WHERE id = ? AND user_id = ?`,
            args: [score != null ? score : 0, new Date().toISOString(), lesson_id, userId]
        });

        // Update stats
        await db.execute({
            sql: `INSERT INTO stats (user_id, total_lessons, last_active, avg_score) VALUES (?, 0, date('now'), ?)
                  ON CONFLICT(user_id) DO UPDATE SET
                    last_active = date('now'),
                    avg_score = (avg_score * total_lessons + ?) / MAX(total_lessons, 1)`,
            args: [userId, score || 0, score || 0]
        });

        res.json({ id, saved: true });
    } catch (err) {
        console.error("[ASSESSMENT] Save error:", err);
        res.status(500).json({ error: err.message });
    }
});

// GET /api/library/lesson/:id/assessments — list all assessments for a lesson
router.get("/lesson/:id/assessments", async (req, res) => {
    const userId = req.user.id;
    try {
        const { rows } = await db.execute({
            sql: `SELECT * FROM assessments WHERE lesson_id = ? AND user_id = ? ORDER BY date_created DESC`,
            args: [req.params.id, userId]
        });
        res.json({
            assessments: rows.map(r => ({
                ...r,
                questions_json: r.questions_json ? JSON.parse(r.questions_json) : [],
                answers_json: r.answers_json ? JSON.parse(r.answers_json) : {},
                score_report_json: r.score_report_json ? JSON.parse(r.score_report_json) : {},
            }))
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
