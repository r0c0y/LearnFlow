import express from "express";
import { getGroq, FAST_MODEL, LARGE_MODEL as HEAVY_MODEL } from "../services/groq.js";

const router = express.Router();

async function callLLM(model, systemPrompt, userMessage, maxTokens = 2000, json = true) {
    for (let attempt = 0; attempt < 3; attempt++) {
        try {
            const params = {
                model,
                max_tokens: maxTokens,
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userMessage },
                ],
            };
            if (json) params.response_format = { type: "json_object" };
            const res = await getGroq().chat.completions.create(params);
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

// POST /api/assess — score a submitted assessment
router.post("/", async (req, res) => {
    const { lesson_id, answers, questions, rubric } = req.body;
    try {
        const result = await callLLM(
            HEAVY_MODEL,
            `You are an expert pedagogical evaluator. Score the student's answers against the correct answers and rubric with high precision.
            
            CRITICAL RULES:
            1. For every question, provide a 'explanation' that explains WHY the student was right or wrong.
            2. If wrong, point out the specific misconception. 
            3. Do NOT use generic phrases like "does not demonstrate understanding". Instead, say "The student confused concept X with Y" or "The answer lacks detail on part Z".
            4. Be encouraging but firm on technical accuracy.
            5. If a rubric is provided, stick to it strictly.

            Return JSON:
            {
              "overall_score": 0-100,
              "per_question": [
                { "question_index": 0, "correct": true/false, "student_answer": "...", "correct_answer": "...", "explanation": "Detailed pedagogical reasoning here", "score": 0-10 }
              ],
              "weak_areas": ["Specific Concept Name"],
              "summary": "Synthesized overview of performance and clear next steps."
            }`,
            JSON.stringify({ answers, questions, rubric })
        );
        res.json(JSON.parse(result));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/assess/next — adaptive difficulty next question
router.post("/next", async (req, res) => {
    const { current_concept, difficulty, lesson_context } = req.body;
    try {
        const prompt =
            difficulty === "hard"
                ? `Generate a HARDER version of the following concept question. Make it require deeper reasoning, edge cases, or multi-step thinking.`
                : `Generate an EASIER, clearer reformulation of the following concept question. Remove ambiguity and add more context clues.`;

        const result = await callLLM(
            FAST_MODEL,
            `${prompt} Return JSON: { "question": "...", "options": ["A","B","C","D"], "correct": "...", "difficulty": "${difficulty}", "explanation": "..." }`,
            `Concept: ${current_concept}\nLesson context: ${lesson_context}`
        );
        res.json(JSON.parse(result));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
