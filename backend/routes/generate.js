import express from "express";
import axios from "axios";

const router = express.Router();

router.post("/", async (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    const send = (data) => { res.write(`data: ${JSON.stringify(data)}\n\n`); };

    try {
        const agentRes = await axios.post(
            `${process.env.AGENT_SERVICE_URL}/pipeline/generate`,
            req.body,
            { responseType: "stream", timeout: 600000 }
        );

        // Simple pipe: just forward the data
        agentRes.data.on("data", (chunk) => {
            res.write(chunk);
            if (res.flush) res.flush();
        });

        agentRes.data.on("end", () => {
            res.end();
        });

        agentRes.data.on("error", (err) => {
            send({ stage: "error", message: "Agent stream failed" });
            res.end();
        });
    } catch (err) {
        send({ stage: "error", message: err.message });
        res.end();
    }
});

export default router;
