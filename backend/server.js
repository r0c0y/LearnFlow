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
import statsRouter from "./routes/stats.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../.env") });

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
app.use("/api/prior-check", chatRouter);  // prior-check uses same router
app.use("/api/explain", explainRouter);
app.use("/api/hint", hintRouter);
app.use("/api/transcribe", transcribeRouter);
app.use("/api/library", libraryRouter);
app.use("/api/save", libraryRouter);
app.use("/api/export", exportRouter);
app.use("/api/reviews", exportRouter);
app.use("/api/stats", statsRouter);

app.get("/health", (_req, res) => res.json({ status: "ok", service: "learnflow-backend" }));

// Init DB and start server
initSchema().then(() => {
    app.listen(PORT, () => {
        console.log(`🚀 LearnFlow backend running on http://localhost:${PORT}`);
    });
}).catch((err) => {
    console.error("❌ Failed to initialize database:", err.message);
    process.exit(1);
});
