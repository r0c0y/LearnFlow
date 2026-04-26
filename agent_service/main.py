import json
import os
import uuid
import tempfile
from pathlib import Path
from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
# Only load .env if essential variables are missing (likely local)
if not os.getenv("GROQ_API_KEY"):
    load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "../.env"))

from pipeline import run_pipeline_with_events
from groq_client import call_llm, HEAVY_MODEL, FAST_MODEL

app = FastAPI(title="LearnFlow Agent Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class PipelineRequest(BaseModel):
    raw_input: dict = {}
    chunks: list = []
    framework: str = "gagne"
    learner_level: str = "beginner"
    prior_knowledge: dict = {}
    max_iterations: int = 1
    iteration: int = 0
    failure_logs: list = []
    student_results: list = []
    lessons: list = []
    status: str = "idle"


class YoutubeRequest(BaseModel):
    url: str


class AnkiRequest(BaseModel):
    lesson_id: str
    lesson: dict = {}


# ─── Pipeline endpoint ──────────────────────────────────────────────────────

@app.post("/pipeline/generate")
async def pipeline_generate(request: PipelineRequest):
    state = request.model_dump()

    def event_stream():
        for event in run_pipeline_with_events(state):
            yield event

    return StreamingResponse(event_stream(), media_type="text/event-stream")


# ─── YouTube transcript endpoint ─────────────────────────────────────────────

@app.post("/ingest/youtube")
async def ingest_youtube(req: YoutubeRequest):
    try:
        from youtube_transcript_api import YouTubeTranscriptApi
        import re

        # Extract video ID from URL
        match = re.search(r"(?:v=|youtu\.be/)([a-zA-Z0-9_-]{11})", req.url)
        if not match:
            raise HTTPException(status_code=400, detail="Invalid YouTube URL")

        video_id = match.group(1)
        transcript_list = YouTubeTranscriptApi.get_transcript(video_id)
        transcript = " ".join([t["text"] for t in transcript_list])
        return {"transcript": transcript, "video_id": video_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─── Anki deck export ────────────────────────────────────────────────────────

@app.post("/export/anki")
async def export_anki(req: AnkiRequest):
    try:
        import genanki
        import random

        lesson = req.lesson
        content = {}
        if lesson.get("content_json"):
            content = json.loads(lesson["content_json"]) if isinstance(lesson["content_json"], str) else lesson["content_json"]

        model_id = random.randrange(1 << 30, 1 << 31)
        deck_id = random.randrange(1 << 30, 1 << 31)

        model = genanki.Model(
            model_id,
            "LearnFlow Card",
            fields=[{"name": "Question"}, {"name": "Answer"}],
            templates=[{
                "name": "Card 1",
                "qfmt": "{{Question}}",
                "afmt": "{{FrontSide}}<hr id=answer>{{Answer}}",
            }],
        )

        deck = genanki.Deck(deck_id, lesson.get("title", "LearnFlow Lesson"))
        lessons_data = content if isinstance(content, list) else [content]

        for lesson_item in lessons_data:
            assessment = lesson_item.get("assessment", {})
            if assessment.get("question"):
                options_str = "\n".join(assessment.get("options", []))
                note = genanki.Note(
                    model=model,
                    fields=[
                        assessment["question"] + ("\n\n" + options_str if options_str else ""),
                        assessment.get("correct_answer", ""),
                    ],
                )
                deck.add_note(note)

        with tempfile.NamedTemporaryFile(suffix=".apkg", delete=False) as tmp:
            tmp_path = tmp.name

        package = genanki.Package(deck)
        package.write_to_file(tmp_path)

        return FileResponse(
            tmp_path,
            media_type="application/octet-stream",
            filename=f"learnflow_{req.lesson_id}.apkg",
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─── Input Quality Advisor ───────────────────────────────────────────────────

class AdvisorRequest(BaseModel):
    content: str
    type: str = "prompt"


@app.post("/advisor/analyze")
async def analyze_input(req: AdvisorRequest):
    try:
        raw = call_llm(
            HEAVY_MODEL,
            """You are an expert instructional designer analyzing a learning request.
Return JSON:
{
  "topic_name": "detected topic",
  "complexity_level": "beginner|intermediate|expert",
  "recommended_framework": "gagne|merrill|bloom",
  "estimated_minutes": 30,
  "is_too_broad": false,
  "focused_angles": ["focused subtopic 1", "focused subtopic 2", "focused subtopic 3"],
  "rationale": "one sentence explanation"
}""",
            f"Learning request: {req.content[:2000]}",
            max_tokens=500,
        )
        return json.loads(raw)
    except json.JSONDecodeError:
        raise HTTPException(status_code=502, detail="AI returned invalid JSON — please retry")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─── Prerequisite detection ──────────────────────────────────────────────────

class PrereqRequest(BaseModel):
    topic: str
    conversation_history: list = []


@app.post("/advisor/prerequisites")
async def detect_prerequisites(req: PrereqRequest):
    try:
        history_text = "\n".join([f"{m['role']}: {m['content']}" for m in req.conversation_history])
        raw = call_llm(
            HEAVY_MODEL,
            """You are an expert educator mapping prerequisite concepts.
Return JSON:
{
  "all_prerequisites": [
    { "concept": "...", "importance": "critical|helpful", "definition": "one sentence" }
  ],
  "known_concepts": ["concept the student mentioned knowing"],
  "gap_concepts": ["concept the student did not mention"]
}""",
            f"Topic: {req.topic}\nConversation:\n{history_text}",
            max_tokens=1000,
        )
        return json.loads(raw)
    except json.JSONDecodeError:
        raise HTTPException(status_code=502, detail="AI returned invalid JSON — please retry")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─── Topic classifier ────────────────────────────────────────────────────────

class ClassifierRequest(BaseModel):
    lesson_content: str


@app.post("/classify/topic")
async def classify_topic(req: ClassifierRequest):
    try:
        raw = call_llm(
            FAST_MODEL,
            """Classify the lesson content and determine the best assessment type.
Return JSON:
{
  "primary_type": "coding|mcq|fill_blank|drag_drop|written|math",
  "secondary_type": "mcq|written|null",
  "language": "python|javascript|sql|null"
}""",
            req.lesson_content[:3000],
            max_tokens=200,
        )
        return json.loads(raw)
    except json.JSONDecodeError:
        return {"primary_type": "mcq", "secondary_type": None, "language": None}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/health")
async def health():
    return {"status": "ok", "service": "learnflow-agent"}
