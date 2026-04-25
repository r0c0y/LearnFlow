import express from "express";
import { getGroq, FAST_MODEL } from "../services/groq.js";

const router = express.Router();

// POST /api/hint — leveled hint system
router.post("/", async (req, res) => {
    const { question_context, hint_level = 1 } = req.body;

    const levelDescriptions = {
        1: "Give a vague conceptual nudge. Point the student in the right direction without giving away anything specific.",
        2: "Give a more specific pointer. Mention the key concept or technique but do NOT show how to use it.",
        3: "Give a related example from a different domain. The example should help the student think laterally but not directly answer the question.",
    };

    const systemPrompt = `You are a Socratic hint assistant. NEVER give the full answer or any part of the solution.
Your ONLY job is to help the student think in the right direction.
Hint level ${hint_level}: ${levelDescriptions[hint_level] || levelDescriptions[1]}
Respond in 1-3 sentences maximum.`;

    try {
        for (let attempt = 0; attempt < 3; attempt++) {
            try {
                const res2 = await getGroq().chat.completions.create({
                    model: FAST_MODEL,
                    max_tokens: 150,
                    messages: [
                        { role: "system", content: systemPrompt },
                        { role: "user", content: `Question context: ${question_context}` },
                    ],
                });
                return res.json({ hint: res2.choices[0].message.content, hint_level });
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
