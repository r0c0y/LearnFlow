import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { initSchema } from "./db/schema.js";

import ingestRouter from "./routes/ingest.js";
import generateRouter from "./routes/generate.js";
import lessonRouter from "./routes/lesson.js";
import assessRouter from "./routes/assess.js";
import chatRouter from "./routes/chat.js";
import explainRouter from "./routes/explain.js";
import hintRouter from "./routes/hint.js";
import transcribeRouter from "./routes/transcribe.js";
import libraryRouter from "./routes/library.js";
import exportRouter from "./routes/export.js";
import authRouter from "./routes/auth.js";
import agentProxyRouter from "./routes/agentProxy.js";
import statsRouter from "./routes/stats.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Only load .env if essential variables are missing (likely local)
if (!process.env.TURSO_DATABASE_URL) {
    dotenv.config({ path: path.join(__dirname, "../.env") });
}

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: "*" }));
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true }));

// Routes
app.use("/api/ingest", ingestRouter);
app.use("/api/generate", generateRouter);
app.use("/api/lesson", lessonRouter);
app.use("/api/assess", assessRouter);
app.use("/api/chat", chatRouter);
app.use("/api/prior-check", chatRouter);
app.use("/api/advisor", agentProxyRouter);
app.use("/api/classify", agentProxyRouter);
app.use("/api/explain", explainRouter);
app.use("/api/hint", hintRouter);
app.use("/api/transcribe", transcribeRouter);
app.use("/api/library", libraryRouter);
app.use("/api/auth", authRouter);
app.use("/api/export", exportRouter);
app.use("/api/reviews", exportRouter);
app.use("/api/stats", statsRouter);

app.get("/health", (_req, res) => res.json({ status: "ok", service: "learnflow-backend" }));

// Export for Vercel
export { app, initSchema };

// Start the server if NOT running on Vercel (e.g., running on Render or locally)
if (!process.env.VERCEL) {
    initSchema().then(() => {
        app.listen(PORT, () => {
            console.log(`🚀 LearnFlow backend running on port ${PORT}`);
        });
    }).catch((err) => {
        console.error("❌ Failed to initialize database:", err.message);
    });
}
