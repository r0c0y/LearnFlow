import json
from groq_client import call_llm, choose_model, HEAVY_MODEL


CONTENT_SYSTEM = """You are a world-class educator creating detailed lesson content.
For each lesson blueprint provided, generate rich, detailed teaching material.
Return JSON exactly matching this format for each lesson:
{
  "lesson_id": "L1",
  "title": "string",
  "hook": "opening statement to grab attention",
  "objectives": ["What you'll learn: ..."],
  "prior_knowledge_check": "question to activate memory",
  "explanation": "full detailed teaching prose with examples woven in — minimum 300 words",
  "worked_example": {
    "setup": "context and problem statement",
    "code": "actual code if applicable — empty string if not a coding topic",
    "walkthrough": "line-by-line or step-by-step explanation"
  },
  "exercise": {
    "instructions": "clear instructions for what student must do",
    "starter_code": "scaffold code if applicable — empty string if not coding",
    "hints": ["hint1 that doesn't give answer", "hint2"],
    "solution": "COMPLETE SOLUTION — hidden from student"
  },
  "assessment": {
    "type": "mcq",
    "question": "clear assessment question",
    "options": ["A. option1", "B. option2", "C. option3", "D. option4"],
    "correct_answer": "A",
    "rubric": "evaluation criteria for written answers"
  }
}"""


def run_content_agent(state: dict) -> dict:
    """Generate full lesson content from blueprint."""
    blueprint = state.get("blueprint", {})
    chunks = state.get("chunks", [])
    failure_logs = state.get("failure_logs", [])
    iteration = state.get("iteration", 0)

    chunk_map = {c["id"]: c["text"] for c in chunks}
    existing_lessons = {l["lesson_id"]: l for l in state.get("lessons", [])}
    failed_ids = {fl["lesson_id"] for fl in failure_logs} if iteration > 0 else set()

    new_lessons = []
    for lesson_bp in blueprint.get("lessons", []):
        lid = lesson_bp["lesson_id"]

        # Skip passing lessons on rewrite iterations
        if iteration > 0 and lid not in failed_ids and lid in existing_lessons:
            new_lessons.append(existing_lessons[lid])
            continue

        # Gather chunks for this lesson
        relevant_chunks = []
        for chunk_id in lesson_bp.get("framework_events", {}).get("content_chunks", []):
            if chunk_id in chunk_map:
                relevant_chunks.append(chunk_map[chunk_id])

        chunk_text = "\n\n".join(relevant_chunks) if relevant_chunks else "\n\n".join([c for c in list(chunk_map.values())[:3]])
        model = choose_model(chunk_text)

        for chunk_idx, chunk_text in enumerate(chunks):
            user_msg = f"""
Generate complete lesson content for:
Blueprint: {json.dumps(lesson_bp, indent=2)}

Source material to teach from:
{chunk_text[:8000]}

Make the explanation thorough, engaging, and pedagogically sound.
If this is a coding topic, include real runnable code examples.
"""
            raw = call_llm(model, CONTENT_SYSTEM, user_msg, max_tokens=4000)
            lesson = json.loads(raw)
            
            new_lessons.append(lesson)

    state["lessons"] = new_lessons
    return state
