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
        const { rows: lessons } = await db.execute({
            sql: `SELECT l.*, lf.folder_id
      FROM lessons l
      LEFT JOIN lesson_folders lf ON l.id = lf.lesson_id
      WHERE l.user_id = ?
      ORDER BY l.date_created DESC`,
            args: [userId],
        });
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
    try {
        const id = lesson.id || uuidv4();

        // AI folder suggestion if not provided
        let suggestedFolder = folder_id;
        let suggestion = null;
        if (!folder_id) {
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
                lesson.score || null,
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
        await db.execute(`
      INSERT INTO stats (id, total_lessons, last_active) VALUES (1, 1, date('now'))
      ON CONFLICT(id) DO UPDATE SET
        total_lessons = total_lessons + 1,
        last_active = date('now'),
        streak_days = CASE
          WHEN last_active = date('now', '-1 day') THEN streak_days + 1
          WHEN last_active = date('now') THEN streak_days
          ELSE 1
        END
    `);

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

export default router;
