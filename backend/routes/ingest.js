import express from "express";
import { chunkText } from "../services/chunker.js";
import { scrapeUrl } from "../services/scraper.js";
import axios from "axios";

const router = express.Router();

// POST /api/ingest — generic text/prompt ingestion
router.post("/", (req, res) => {
    const { type, content } = req.body;
    if (!content) return res.status(400).json({ error: "content required" });
    const chunks = chunkText(content);
    res.json({ chunks, type, total: chunks.length });
});

// POST /api/ingest/url — scrape a URL
router.post("/url", async (req, res) => {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: "url required" });
    try {
        const text = await scrapeUrl(url);
        const chunks = chunkText(text);
        res.json({ text, chunks, total: chunks.length });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/ingest/youtube — get transcript via Python agent service
router.post("/youtube", async (req, res) => {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: "url required" });
    try {
        const { data } = await axios.post(
            `${process.env.AGENT_SERVICE_URL}/ingest/youtube`,
            { url }
        );
        const chunks = chunkText(data.transcript);
        res.json({ transcript: data.transcript, chunks, total: chunks.length });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
