import express from "express";
import axios from "axios";

const router = express.Router();

/**
 * POST /api/generate
 * Streams SSE progress from the Python agent pipeline.
 * Body: full pipeline state object
 */
router.post("/", async (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();

    const send = (data) => { res.write(`data: ${JSON.stringify(data)}\n\n`); if (res.flush) res.flush(); };

    try {
        send({ stage: "ingesting", message: "Reading your document..." });

        const agentRes = await axios.post(
            `${process.env.AGENT_SERVICE_URL}/pipeline/generate`,
            req.body,
            { responseType: "stream", timeout: 300000 }
        );

        // Heartbeat to keep connection alive during long AI tasks
        const heartbeat = setInterval(() => {
            res.write(': keep-alive\n\n');
            if (res.flush) res.flush();
        }, 15000);

        let buffer = "";
        agentRes.data.on("data", (chunk) => {
            buffer += chunk.toString("utf8");
            const lines = buffer.split("\n");
            
            // Keep the last partial line in the buffer
            buffer = lines.pop() || "";

            lines.forEach((line) => {
                const trimmed = line.trim();
                if (trimmed.startsWith("data:")) {
                    res.write(trimmed + "\n\n");
                    if (res.flush) res.flush();
                }
            });
        });

        agentRes.data.on("end", () => {
            clearInterval(heartbeat);
            // Process any remaining data in buffer
            if (buffer.trim().startsWith("data:")) {
                res.write(buffer.trim() + "\n\n");
            }
            res.write("data: {\"stage\":\"done\"}\n\n");
            if (res.flush) res.flush();
            res.end();
        });

        agentRes.data.on("error", (err) => {
            clearInterval(heartbeat);
            send({ stage: "error", message: err.message });
            res.end();
        });
    } catch (err) {
        send({ stage: "error", message: err.message });
        res.end();
    }
});

export default router;
