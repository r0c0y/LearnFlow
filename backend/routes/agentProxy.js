import express from "express";
import axios from "axios";

const router = express.Router();

router.post("/analyze", async (req, res) => {
    try {
        const agentRes = await axios.post(
            `${process.env.AGENT_SERVICE_URL}/advisor/analyze`,
            req.body,
            { timeout: 300000 }
        );
        res.json(agentRes.data);
    } catch (err) {
        res.status(500).json({ error: err.message || "Agent service error" });
    }
});

router.post("/prerequisites", async (req, res) => {
    try {
        const agentRes = await axios.post(
            `${process.env.AGENT_SERVICE_URL}/advisor/prerequisites`,
            req.body,
            { timeout: 300000 }
        );
        res.json(agentRes.data);
    } catch (err) {
        res.status(500).json({ error: err.message || "Agent service error" });
    }
});

router.post("/topic", async (req, res) => {
    try {
        const agentRes = await axios.post(
            `${process.env.AGENT_SERVICE_URL}/classify/topic`,
            req.body,
            { timeout: 300000 }
        );
        res.json(agentRes.data);
    } catch (err) {
        res.status(500).json({ error: err.message || "Agent service error" });
    }
});

export default router;
