import express from "express";
import { getGroq, FAST_MODEL } from "../services/groq.js";

const router = express.Router();

async function callLLM(systemPrompt, userMessage, maxTokens = 800) {
    for (let attempt = 0; attempt < 3; attempt++) {
        try {
            const res = await getGroq().chat.completions.create({
                model: FAST_MODEL,
                max_tokens: maxTokens,
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userMessage },
                ],
            });
            return res.choices[0].message.content;
        } catch (err) {
            if (err.status === 429 && attempt < 2) {
                await new Promise((r) => setTimeout(r, Math.pow(2, attempt) * 1000 + Math.random() * 500));
                continue;
            }
            throw err;
        }
    }
}

// POST /api/explain — rewrite a content block in a different style
router.post("/", async (req, res) => {
    const { block_content, style, topic } = req.body;
    const styleMap = {
        simpler: "Rewrite this explanation in the simplest possible language, as if explaining to a complete beginner. Use very short sentences.",
        analogy: "Rewrite this explanation using a vivid, memorable analogy from everyday life. Make the analogy concrete and relatable.",
        realworld: "Rewrite this explanation focusing entirely on a real-world use case. Show exactly how this concept is applied in a production system or real project.",
    };
    const instruction = styleMap[style] || styleMap.simpler;
    try {
        const result = await callLLM(instruction, `Topic: ${topic}\n\nContent:\n${block_content}`);
        res.json({ rewritten: result });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/explain/term — define a technical term in 1-2 sentences
router.post("/term", async (req, res) => {
    const { term, lesson_context } = req.body;
    try {
        const result = await callLLM(
            `You are a technical dictionary. Define the given term in exactly 1-2 plain-English sentences. No jargon. No bullet points. Just the definition.`,
            `Term: "${term}"\nContext from lesson: ${lesson_context?.slice(0, 500) || ""}`
        );
        res.json({ term, definition: result });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
