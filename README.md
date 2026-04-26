# 🧠 LearnFlow — AI-Powered Adaptive Learning Platform

<p align="center">
  <img src="https://img.shields.io/badge/React-18-61DAFB?logo=react" alt="React" />
  <img src="https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Express-4-000?logo=express" alt="Express" />
  <img src="https://img.shields.io/badge/FastAPI-0.100-009688?logo=fastapi" alt="FastAPI" />
  <img src="https://img.shields.io/badge/LangGraph-Agentic-FF6F00" alt="LangGraph" />
  <img src="https://img.shields.io/badge/Groq-LLM-EF4444" alt="Groq" />
  <img src="https://img.shields.io/badge/Turso-DB-4FF8D2?logo=turso" alt="Turso" />
</p>

LearnFlow transforms any content — text, PDFs, or YouTube videos — into **structured, interactive lessons** using a multi-agent AI pipeline. It adapts to your knowledge level, generates assessments with AI grading, and tracks your learning progress over time.

---

## ✨ Features

- **🤖 Agentic Content Pipeline** — 4-agent LangGraph workflow (Architect → Content → Student → Evaluator) with automatic refinement loops
- **📚 Adaptive Lessons** — Topic-based sections with rich markdown, code examples, and reference links
- **📝 Smart Assessments** — AI-graded quizzes with adaptive difficulty and progressive hints
- **📁 Library Management** — Organize lessons in folders, view assessment history, retake quizzes
- **📊 Analytics Dashboard** — Track streak, scores, lesson count, and learning progress
- **💬 AI Tutor Chat** — Ask questions about lesson content in real-time
- **🔄 Spaced Repetition** — Automated review scheduling for long-term retention
- **📤 Export** — Download lessons as PDF, Markdown, or Anki flashcard decks
- **🔐 Authentication** — Per-user accounts with JWT-based auth
- **🌙 Dark Theme** — Premium dark UI with smooth animations

---

## 🏗️ Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────────┐
│    Frontend      │────▶│    Backend       │────▶│   Agent Service     │
│  React + Vite   │     │  Express.js      │     │  FastAPI + LangGraph│
│  :5173          │     │  :3001           │     │  :8000              │
└─────────────────┘     └──────┬───────────┘     └──────────┬──────────┘
                               │                            │
                        ┌──────▼───────┐            ┌───────▼────────┐
                        │   Turso DB   │            │   Groq LLM    │
                        │  (LibSQL)    │            │  (Llama 3)    │
                        └──────────────┘            └────────────────┘
```

The **Agent Pipeline** uses a LangGraph state machine with 4 agents:

1. **Architect Agent** — Designs lesson structure from content chunks
2. **Content Agent** — Generates detailed lessons (500+ word explanations, code, examples)
3. **Student Agent** — Simulates a learner to test lesson quality
4. **Evaluator Agent** — Grades simulated answers; triggers refinement if quality is low

> See [report.md](report.md) for the full technical architecture documentation.

---

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- Python 3.10+
- [Groq API key](https://console.groq.com)
- [Turso database](https://turso.tech)

### 1. Clone & Install

```bash
git clone https://github.com/r0c0y/LearnFlow.git
cd LearnFlow

# Backend
cd backend && npm install && cd ..

# Frontend
cd frontend && npm install && cd ..

# Agent Service
cd agent_service && pip install -r requirements.txt && cd ..
```

### 2. Configure Environment

Create a `.env` file in the project root:

```env
# LLM
GROQ_API_KEY=gsk_your_key_here

# Database
TURSO_DATABASE_URL=libsql://your-db.turso.io
TURSO_AUTH_TOKEN=your_turso_token

# Agent Service
AGENT_SERVICE_URL=http://localhost:8000

# Auth
JWT_SECRET=your_secret_key

# Optional
MAX_ITERATIONS=3
PORT=3001
```

### 3. Run All Services

```bash
# Terminal 1 — Agent Service
cd agent_service && python3 -m uvicorn main:app --port 8000

# Terminal 2 — Backend
cd backend && node server.js

# Terminal 3 — Frontend
cd frontend && npm run dev
```

Open **http://localhost:5173** in your browser.

---

## 📂 Project Structure

```
LearnFlow/
├── frontend/              # React + TypeScript SPA
│   ├── src/
│   │   ├── pages/         # AuthPage, InputPage, PreLessonPage,
│   │   │                  # LessonPage, AssessmentPage, LibraryPage,
│   │   │                  # AnalyticsPage
│   │   ├── store/         # Zustand stores (lesson, assessment, auth, library)
│   │   ├── components/    # FolderPicker, etc.
│   │   ├── hooks/         # useConfusionDetector, useSpacedRepetition
│   │   └── utils/         # authFetch helper
│   └── index.html
│
├── backend/               # Express.js API gateway
│   ├── server.js          # Entry point — mounts all routes
│   ├── routes/            # 13 API modules (auth, assess, library, etc.)
│   ├── middleware/        # JWT auth middleware
│   ├── db/                # Turso client + schema init
│   └── services/          # Groq client wrapper
│
├── agent_service/         # Python FastAPI — Agentic pipeline
│   ├── main.py            # FastAPI app + endpoints
│   ├── pipeline.py        # LangGraph state machine
│   ├── groq_client.py     # LLM wrapper
│   ├── schemas.py         # Pydantic data models
│   └── agents/            # 4 pipeline agents
│       ├── architect_agent.py
│       ├── content_agent.py
│       ├── student_agent.py
│       └── evaluator.py
│
└── .env                   # Environment configuration
```

---

## 🔑 API Reference

| Category | Endpoint | Method | Description |
|----------|----------|--------|-------------|
| Auth | `/api/auth/register` | POST | Create account |
| Auth | `/api/auth/login` | POST | Login → JWT |
| Content | `/api/ingest` | POST | Upload & chunk content |
| Content | `/api/generate` | POST | Run agentic pipeline (SSE) |
| Lesson | `/api/lesson/:id` | GET | Fetch saved lesson |
| Lesson | `/api/lesson/branch` | POST | Rewrite a section |
| Quiz | `/api/assess` | POST | Grade assessment |
| Quiz | `/api/assess/next` | POST | Adaptive next question |
| Quiz | `/api/hint` | POST | Get hint (3 levels) |
| Chat | `/api/chat` | POST | AI tutor conversation |
| Library | `/api/library` | GET | All lessons & folders |
| Library | `/api/library/save` | POST | Save lesson |
| Library | `/api/library/assessment` | POST | Save assessment attempt |
| Library | `/api/library/lesson/:id/assessments` | GET | Assessment history |
| Stats | `/api/stats` | GET | User analytics |
| Export | `/api/export/pdf` | POST | Export as PDF |

---

## 🧪 Tech Stack

| Component | Technology |
|-----------|-----------|
| Frontend | React 18, TypeScript, Vite |
| State Management | Zustand |
| Code Editor | Monaco Editor |
| Markdown Rendering | ReactMarkdown + remark-gfm |
| Backend | Express.js (Node 18) |
| Authentication | JWT (jsonwebtoken) |
| Agent Pipeline | LangGraph (Python) |
| AI/LLM | Groq API (Llama 3) |
| Database | Turso (LibSQL) |
| Python Framework | FastAPI + Uvicorn |

---

## 📄 License

MIT License — see [LICENSE](LICENSE) for details.

---

<p align="center">
  Built with ❤️ using AI-powered agentic workflows
</p>
