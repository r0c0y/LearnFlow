import json
from groq_client import call_llm, choose_model, HEAVY_MODEL


GAGNE_SYSTEM = """You are an expert instructional designer using Gagne's Nine Events of Instruction.
Map the provided content chunks to a structured lesson blueprint. Each lesson should cover one cohesive concept.
Return JSON strictly matching this format:
{
  "lessons": [
    {
      "lesson_id": "L1",
      "title": "string",
      "framework_events": {
        "gain_attention": "hook from content",
        "objectives": ["obj1", "obj2"],
        "prior_recall": "question to activate prior knowledge",
        "content_chunks": ["chunk_000", "chunk_001"],
        "guided_example": "describe the worked example",
        "exercise": { "type": "coding_task|mcq|written", "description": "string", "expected_output": "string" },
        "feedback_rubric": "how to evaluate the student",
        "assessment": { "type": "mcq|coding|fill_blank|drag_drop|written", "question": "string", "options": [], "correct": "string" },
        "real_world": "real-world application idea"
      }
    }
  ]
}"""

MERRILL_SYSTEM = """You are an expert instructional designer using Merrill's First Principles of Instruction.
Map the provided content chunks to lessons following: Problem-centered, Activation, Demonstration, Application, Integration.
Return JSON strictly matching this format:
{
  "lessons": [
    {
      "lesson_id": "L1",
      "title": "string",
      "framework_events": {
        "gain_attention": "real problem to open with",
        "objectives": ["obj1"],
        "prior_recall": "connect to existing knowledge",
        "content_chunks": ["chunk_000"],
        "guided_example": "demonstration description",
        "exercise": { "type": "coding_task|mcq|written", "description": "string", "expected_output": "string" },
        "feedback_rubric": "evaluation criteria",
        "assessment": { "type": "mcq|coding|fill_blank|drag_drop|written", "question": "string", "options": [], "correct": "string" },
        "real_world": "integration into real practice"
      }
    }
  ]
}"""


def run_architect_agent(state: dict) -> dict:
    """Generate or refine the lesson blueprint."""
    framework = state.get("framework", "gagne")
    chunks = state.get("chunks", [])
    prior_knowledge = state.get("prior_knowledge", {})
    failure_logs = state.get("failure_logs", [])
    iteration = state.get("iteration", 0)

    chunk_text = "\n\n".join([f"[{c['id']}] {c['text']}" for c in chunks[:20]])

    if iteration > 0 and failure_logs:
        # Selective rewrite — only fix failed lessons
        failed_ids = [fl["lesson_id"] for fl in failure_logs]
        user_msg = f"""
REWRITE ITERATION {iteration}: Only re-architect these failed lessons: {failed_ids}
Failure reasons: {json.dumps(failure_logs, indent=2)}

Prior knowledge of student:
Known: {prior_knowledge.get('known', [])}
Gaps: {prior_knowledge.get('gaps', [])}

Content chunks:
{chunk_text}

Keep all passing lessons unchanged. Only return the complete lessons array (with rewrites for failed ones).
"""
    else:
        user_msg = f"""
Prior knowledge of student:
Known: {prior_knowledge.get('known', [])}
Gaps: {prior_knowledge.get('gaps', [])}
Learner level: {state.get('learner_level', 'beginner')}

Content chunks to teach:
{chunk_text}

Create a lesson blueprint covering all major concepts in the chunks.
Target EXACTLY 3 lessons (no more, no less). Keep it focused and concise.
"""

    system_prompt = GAGNE_SYSTEM if framework == "gagne" else MERRILL_SYSTEM
    model = choose_model(chunk_text)

    raw = call_llm(model, system_prompt, user_msg, max_tokens=3000)
    blueprint = json.loads(raw)

    # Merge: keep passing lessons from previous iteration
    if iteration > 0 and state.get("blueprint"):
        prev_lessons = {l["lesson_id"]: l for l in state["blueprint"].get("lessons", [])}
        failed_ids_set = {fl["lesson_id"] for fl in failure_logs}
        new_lessons = {l["lesson_id"]: l for l in blueprint.get("lessons", [])}
        merged = []
        for lid, lesson in prev_lessons.items():
            if lid in failed_ids_set and lid in new_lessons:
                merged.append(new_lessons[lid])
            else:
                merged.append(lesson)
        blueprint["lessons"] = merged

    state["blueprint"] = blueprint
    return state
