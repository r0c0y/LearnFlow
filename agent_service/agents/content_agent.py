import json
import time
import concurrent.futures
from groq_client import call_llm, choose_model, HEAVY_MODEL

CONTENT_SYSTEM = """You are a world-class educator and subject matter expert creating comprehensive, detailed lesson content.
Your lessons should feel like reading a well-written textbook chapter — thorough, clear, and engaging.

For each lesson blueprint provided, generate rich, detailed teaching material.
Return JSON exactly matching this format for each lesson:
{
  "lesson_id": "L1",
  "title": "string",
  "hook": "A compelling 2-3 sentence opening that explains WHY this topic matters, with a real-world scenario or surprising fact that grabs attention",
  "objectives": ["Specific learning outcome 1", "Specific learning outcome 2", "Specific learning outcome 3"],
  "prior_knowledge_check": "A thoughtful question that connects to what the student already knows",
  "explanation": "DETAILED teaching content in markdown format. Include:\\n\\n## Key Concepts\\nDefine and explain each core concept with clear definitions.\\n\\n## How It Works\\nStep-by-step breakdown of the mechanism/process.\\n\\n## Real-World Analogy\\nAn intuitive analogy that makes the concept click.\\n\\n## Examples\\nAt least 2-3 concrete examples with explanations.\\n\\n## Common Mistakes\\nWhat learners typically get wrong and how to avoid it.\\n\\n## Further Reading\\n- [Official Documentation](relevant_url)\\n- [Tutorial Resource](relevant_url)",
  "summary": "A 3-4 sentence recap of the most important points from this lesson",
  "key_takeaways": ["Takeaway 1 - the single most important thing", "Takeaway 2", "Takeaway 3"],
  "worked_example": {
    "setup": "Clear problem statement with context — what are we trying to solve?",
    "code": "Complete, well-commented, runnable code if applicable — empty string if not a coding topic",
    "walkthrough": "Detailed step-by-step explanation of the example. Explain WHY each step matters."
  },
  "exercise": {
    "instructions": "Clear, specific instructions. What is the goal? What are the constraints? Provide examples of expected output.",
    "starter_code": "Scaffold code with TODO comments if applicable — empty string if not coding",
    "hints": ["Helpful hint 1 that guides without giving away", "Hint 2 with more detail", "Hint 3 with concrete approach"],
    "solution": "COMPLETE SOLUTION with comments explaining each step"
  },
  "assessment": {
    "type": "mcq",
    "question": "A thoughtful question that tests understanding, not just memorization",
    "options": ["A. Plausible option 1", "B. Plausible option 2", "C. Plausible option 3", "D. Plausible option 4"],
    "correct_answer": "A",
    "rubric": "Detailed evaluation criteria for written answers"
  }
}

CRITICAL RULES:
1. The 'explanation' field MUST have markdown headings and examples.
2. Include relevant reference links (Wikipedia, MDN, official docs, etc.).
3. Use markdown formatting: ## headings, **bold**, `code`, bullet lists.
4. Every concept must have at least one concrete example.
5. The content should be self-sufficient.
6. Include 'summary' and 'key_takeaways' fields."""

# Semaphore to limit concurrent Groq requests and avoid rate limits
_GROQ_SEMAPHORE = concurrent.futures.ThreadPoolExecutor(max_workers=2)


def _generate_with_retry(model, system, user_msg, lesson_id, max_retries=3):
    """Call LLM with exponential backoff on rate-limit errors."""
    for attempt in range(max_retries):
        try:
            raw = call_llm(model, system, user_msg, max_tokens=4000)
            return json.loads(raw)
        except Exception as e:
            err = str(e)
            is_rate_limit = "429" in err or "rate_limit" in err.lower() or "rate limit" in err.lower()
            is_last = attempt == max_retries - 1
            if is_rate_limit and not is_last:
                wait = 2 ** attempt  # 1s, 2s, 4s
                print(f"Rate limit on {lesson_id} attempt {attempt + 1}, retrying in {wait}s...")
                time.sleep(wait)
            else:
                print(f"Content generation failed for {lesson_id}: {e}")
                raise
    raise RuntimeError(f"All retries exhausted for {lesson_id}")


def run_content_agent(state: dict) -> dict:
    """Generate full lesson content from blueprint using 70B model."""
    blueprint = state.get("blueprint", {})
    chunks = state.get("chunks", [])
    failure_logs = state.get("failure_logs", [])
    iteration = state.get("iteration", 0)

    chunk_map = {c["id"]: c["text"] for c in chunks}
    existing_lessons = {l["lesson_id"]: l for l in state.get("lessons", [])}
    failed_ids = {fl["lesson_id"] for fl in failure_logs} if iteration > 0 else set()

    def generate_single_lesson(lesson_bp):
        lid = lesson_bp["lesson_id"]

        # Skip passing lessons on rewrite iterations
        if iteration > 0 and lid not in failed_ids and lid in existing_lessons:
            return existing_lessons[lid]

        # Gather chunks for this lesson
        relevant_chunks = []
        for chunk_id in lesson_bp.get("framework_events", {}).get("content_chunks", []):
            if chunk_id in chunk_map:
                relevant_chunks.append(chunk_map[chunk_id])

        chunk_text = "\n\n".join(relevant_chunks) if relevant_chunks else "\n\n".join(list(chunk_map.values())[:3])
        # Always use 70B for best content quality
        model = HEAVY_MODEL

        learner_level = state.get("learner_level", "beginner")
        user_msg = f"""Generate comprehensive lesson content for:
Topic: {lesson_bp.get("title", "Unknown")}
Learner Level: {learner_level}
Blueprint: {json.dumps(lesson_bp, indent=2)}

Source material:
{chunk_text[:6000]}

Requirements:
- Write a detailed explanation with markdown headings and examples
- Include a worked example with walkthrough
- Include an exercise with hints and solution
- Include an MCQ assessment question
- Make content appropriate for a {learner_level} level student
- Include summary and key_takeaways fields
"""
        try:
            lesson_content = _generate_with_retry(model, CONTENT_SYSTEM, user_msg, lid)
        except Exception:
            # Fallback stub — never crash the pipeline
            lesson_content = {
                "lesson_id": lid,
                "title": lesson_bp.get("title", "Lesson"),
                "hook": "Let's explore this topic together.",
                "objectives": lesson_bp.get("framework_events", {}).get("objectives", ["Understand the key concepts"]),
                "prior_knowledge_check": "What do you already know about this topic?",
                "explanation": f"## {lesson_bp.get('title', 'Topic')}\n\n{chunk_text[:800] if chunk_text else 'Content coming soon.'}",
                "summary": "Review the key ideas from this lesson.",
                "key_takeaways": ["Review the core concept", "Practice with the exercise", "Check your understanding with the assessment"],
                "worked_example": {"setup": "", "code": "", "walkthrough": ""},
                "exercise": {"instructions": "Practice what you've learned.", "starter_code": "", "hints": [], "solution": ""},
                "assessment": {
                    "type": "mcq",
                    "question": f"What is the main concept of {lesson_bp.get('title', 'this lesson')}?",
                    "options": ["A. Option 1", "B. Option 2", "C. Option 3", "D. Option 4"],
                    "correct_answer": "A",
                    "rubric": "Evaluate understanding of core concepts",
                },
            }
        return lesson_content

    blueprint_lessons = blueprint.get("lessons", [])
    new_lessons = []

    if blueprint_lessons:
        # Process sequentially to strictly avoid Groq rate limits on free tier
        # Concurrent requests often trigger 429s (thundering herd) and exhaust retries
        for lesson_bp in blueprint_lessons:
            new_lessons.append(generate_single_lesson(lesson_bp))

    state["lessons"] = new_lessons
    return state
