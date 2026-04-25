import express from "express";
import { getGroq, FAST_MODEL } from "../services/groq.js";

const router = express.Router();

async function callLLM(model, systemPrompt, userMessage, maxTokens = 1500) {
    for (let attempt = 0; attempt < 3; attempt++) {
        try {
            const res = await getGroq().chat.completions.create({
                model,
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

// POST /api/chat — discussion chat with lesson context
router.post("/", async (req, res) => {
    const { message, lesson_context, history = [] } = req.body;
    try {
        const messages = [
            {
                role: "system",
                content: `You are a helpful tutor assistant. Answer questions about the lesson concisely and clearly.
Lesson context:
${lesson_context}`,
            },
            ...history,
            { role: "user", content: message },
        ];
        const result = await getGroq().chat.completions.create({
            model: FAST_MODEL,
            max_tokens: 500,
            messages,
        });
        res.json({ reply: result.choices[0].message.content });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/prior-check — prior knowledge chat
router.post("/prior", async (req, res) => {
    const { messages, topic } = req.body;
    try {
        const systemMsg = {
            role: "system",
            content: `You are an intelligent tutor running a prior knowledge assessment for the topic: "${topic}".
Ask the student what they already know. After 2-3 turns, summarize gaps. Keep responses SHORT (1-2 sentences + 1 question).`,
        };
        const allMessages = [systemMsg, ...messages];
        const result = await getGroq().chat.completions.create({
            model: FAST_MODEL,
            max_tokens: 300,
            messages: allMessages,
        });
        res.json({ reply: result.choices[0].message.content });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
