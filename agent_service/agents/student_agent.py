import json
import re
from groq_client import call_llm, FAST_MODEL


STUDENT_SYSTEM = """You are simulating a real student who has just read a lesson for the first time.
You are NOT an expert. You understand some things, get confused by others.
You will attempt the exercise and answer the assessment question from memory.
CRITICAL: You never see the solution, correct answer, rubric, or any teacher notes.

RESPOND WITH VALID JSON ONLY — no markdown, no code fences, no extra text.
The JSON must have EXACTLY these 4 keys with EXACTLY these value types:

{
  "exercise_attempt": "<a single string containing your code or written answer>",
  "assessment_answer": "<a single string with your answer>",
  "confidence_score": <an integer from 1 to 10>,
  "confusion_points": ["<string>", "<string>"]
}

EXAMPLE OF CORRECT OUTPUT:
{
  "exercise_attempt": "def add(a, b):\\n    return a + b\\nprint(add(2, 3))",
  "assessment_answer": "B",
  "confidence_score": 7,
  "confusion_points": ["Not sure when to use list vs tuple"]
}

RULES:
- exercise_attempt must be ONE string. Escape newlines as \\n inside the string.
- Do NOT use Python code as a JSON key — it must be a value.
- Do NOT wrap output in ```json``` or any markdown.
- Do NOT add extra keys."""


def _strip_secrets(lesson: dict) -> dict:
    """Remove solutions, answers, and rubrics — only keep what a real student sees."""
    safe = {
        "lesson_id": lesson.get("lesson_id"),
        "title": lesson.get("title"),
        "hook": lesson.get("hook"),
        "objectives": lesson.get("objectives"),
        "explanation": lesson.get("explanation"),
        "prior_knowledge_check": lesson.get("prior_knowledge_check"),
        "worked_example": {
            "setup": lesson.get("worked_example", {}).get("setup", ""),
            "code": lesson.get("worked_example", {}).get("code", ""),
            "walkthrough": lesson.get("worked_example", {}).get("walkthrough", ""),
            # NO solution field
        },
        "exercise": {
            "instructions": lesson.get("exercise", {}).get("instructions", ""),
            "starter_code": lesson.get("exercise", {}).get("starter_code", ""),
            "hints": lesson.get("exercise", {}).get("hints", []),
            # NO solution field
        },
        "assessment": {
            "type": lesson.get("assessment", {}).get("type"),
            "question": lesson.get("assessment", {}).get("question"),
            "options": lesson.get("assessment", {}).get("options", []),
            # NO correct_answer, NO rubric
        },
    }
    return safe


def _safe_parse(raw: str, lesson_id: str) -> dict:
    """Parse LLM response with fallback — handles code-as-key malformation."""
    # Strip markdown code fences if present
    cleaned = re.sub(r"^```(?:json)?\s*", "", raw.strip())
    cleaned = re.sub(r"\s*```$", "", cleaned)

    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        # Fallback: extract key fields with regex
        attempt_match = re.search(r'"exercise_attempt"\s*:\s*"((?:[^"\\]|\\.)*)"', cleaned)
        answer_match = re.search(r'"assessment_answer"\s*:\s*"([^"]*)"', cleaned)
        conf_match = re.search(r'"confidence_score"\s*:\s*(\d+)', cleaned)
        return {
            "exercise_attempt": attempt_match.group(1) if attempt_match else "(could not parse)",
            "assessment_answer": answer_match.group(1) if answer_match else "(unknown)",
            "confidence_score": int(conf_match.group(1)) if conf_match else 5,
            "confusion_points": ["Response parsing failed — LLM returned malformed JSON"],
        }


def run_student_agent(state: dict) -> dict:
    """Simulate student attempting each lesson — completely isolated context."""
    lessons = state.get("lessons", [])
    failure_logs = state.get("failure_logs", [])
    iteration = state.get("iteration", 0)
    failed_ids = {fl["lesson_id"] for fl in failure_logs} if iteration > 0 else set()

    existing_results = {r["lesson_id"]: r for r in state.get("student_results", [])}
    results = []

    for lesson in lessons:
        lid = lesson.get("lesson_id", "?")

        # Only re-test failed lessons on rewrite iterations
        if iteration > 0 and lid not in failed_ids and lid in existing_results:
            results.append(existing_results[lid])
            continue

        safe_lesson = _strip_secrets(lesson)

        user_msg = f"""Here is the lesson you just completed (as a student):

TOPIC: {safe_lesson.get('title', '')}

EXPLANATION SUMMARY:
{str(safe_lesson.get('explanation', ''))[:800]}

EXERCISE:
{safe_lesson.get('exercise', {}).get('instructions', '')}

ASSESSMENT QUESTION:
{safe_lesson.get('assessment', {}).get('question', '')}
Options: {safe_lesson.get('assessment', {}).get('options', [])}

Attempt the exercise and answer the assessment question as a student.
Return ONLY valid JSON matching the exact schema in your instructions."""

        raw = call_llm(FAST_MODEL, STUDENT_SYSTEM, user_msg, max_tokens=500)
        result = _safe_parse(raw, lid)
        result["lesson_id"] = lid
        results.append(result)

    state["student_results"] = results
    return state
