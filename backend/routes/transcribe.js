import express from "express";
import multer from "multer";
import { getGroqSdk } from "../services/groq.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const router = express.Router();

const upload = multer({
    dest: path.join(__dirname, "../../uploads/"),
    limits: { fileSize: 25 * 1024 * 1024 }, // 25MB max
});

// POST /api/transcribe — Groq Whisper transcription
router.post("/", upload.single("audio"), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: "No audio file uploaded" });

    try {
        const transcription = await getGroqSdk().audio.transcriptions.create({
            file: fs.createReadStream(req.file.path),
            model: "whisper-large-v3",
            response_format: "verbose_json",
        });

        // Clean up uploaded file
        fs.unlinkSync(req.file.path);

        res.json({ text: transcription.text });
    } catch (err) {
        // Best-effort cleanup
        try { fs.unlinkSync(req.file.path); } catch (_) { }
        res.status(500).json({ error: err.message });
    }
});

export default router;
