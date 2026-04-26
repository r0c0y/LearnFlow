import json
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
  "explanation": "DETAILED teaching content in markdown format. This MUST be at least 500 words and include:\\n\\n## Key Concepts\\nDefine and explain each core concept with clear definitions.\\n\\n## How It Works\\nStep-by-step breakdown of the mechanism/process.\\n\\n## Real-World Analogy\\nAn intuitive analogy that makes the concept click.\\n\\n## Examples\\nAt least 2-3 concrete examples with explanations.\\n\\n## Common Mistakes\\nWhat learners typically get wrong and how to avoid it.\\n\\n## Further Reading\\n- [Official Documentation](relevant_url)\\n- [Tutorial Resource](relevant_url)",
  "summary": "A 3-4 sentence recap of the most important points from this lesson",
  "key_takeaways": ["Takeaway 1 - the single most important thing", "Takeaway 2", "Takeaway 3"],
  "worked_example": {
    "setup": "Clear problem statement with context — what are we trying to solve? Describe the scenario in 2-3 paragraphs.",
    "code": "Complete, well-commented, runnable code if applicable — empty string if not a coding topic",
    "walkthrough": "EXTREMELY DETAILED line-by-line or step-by-step explanation of the example. This MUST be at least 300 words. Explain WHY each step matters, alternatives considered, and edge cases."
  },
  "exercise": {
    "instructions": "Clear, specific, multi-paragraph instructions. What is the goal? What are the constraints? Provide examples of expected output. Minimum 150 words.",
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
1. The 'explanation' field should be around 300-400 words with markdown headings and examples.
2. The 'worked_example.walkthrough' should be clear and concise (around 150 words).
3. The 'exercise.instructions' should be specific and actionable.
4. Include relevant reference links (Wikipedia, MDN, official docs, etc.) in the explanation.
5. Use markdown formatting: ## headings, **bold** for key terms, `code` for technical terms, bullet lists.
6. Every concept must have at least one concrete example.
7. The content should be self-sufficient — a student should be able to master the topic just from reading it.
8. Include 'summary' and 'key_takeaways' fields for the review section."""


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

        learner_level = state.get("learner_level", "beginner")
        user_msg = f"""
Generate comprehensive, detailed lesson content for:
Topic: {lesson_bp.get("title", "Unknown")}
Learner Level: {learner_level}
Blueprint: {json.dumps(lesson_bp, indent=2)}

Source material to teach from:
{chunk_text[:8000]}

IMPORTANT REQUIREMENTS:
1. Write the 'explanation' as a clear, detailed article (around 350 words) using markdown.
2. Ensure the 'worked_example.walkthrough' is a concise, step-by-step tutorial (around 150 words).
3. Provide specific 'exercise.instructions' that set up a scenario for the student.
4. Include real reference links to documentation, Wikipedia, or learning resources (use actual URLs).
5. Break down complex ideas into digestible pieces with analogies.
6. Include at least 2-3 concrete examples within the explanation.
7. Add a 'summary' field (3-4 sentence recap) and 'key_takeaways' field (list of 3 key points).
8. If this is a coding topic, include real runnable code with detailed comments in the explanation, example, and exercise.
9. Make content appropriate for a {learner_level} level student, but do not skimp on detail.
"""
        try:
            raw = call_llm(model, CONTENT_SYSTEM, user_msg, max_tokens=6000)
            lesson_content = json.loads(raw)
        except Exception as e:
            print(f"Content generation failed for {lid}: {e}")
            # Create a minimal stub so the pipeline doesn't crash
            lesson_content = {
                "lesson_id": lid,
                "title": lesson_bp.get("title", "Lesson"),
                "hook": "Let's explore this topic together.",
                "objectives": lesson_bp.get("framework_events", {}).get("objectives", ["Understand the key concepts"]),
                "prior_knowledge_check": "What do you already know about this topic?",
                "explanation": f"This lesson covers: {lesson_bp.get('title', 'the topic')}. {chunk_text[:500] if chunk_text else ''}",
                "worked_example": {"setup": "", "code": "", "walkthrough": ""},
                "exercise": {"instructions": "Practice what you've learned.", "starter_code": "", "hints": [], "solution": ""},
                "assessment": {
                    "type": "mcq",
                    "question": f"What is the main concept of {lesson_bp.get('title', 'this lesson')}?",
                    "options": ["A. Option 1", "B. Option 2", "C. Option 3", "D. Option 4"],
                    "correct_answer": "A",
                    "rubric": "Evaluate understanding of core concepts"
                },
            }

        new_lessons.append(lesson_content)

    state["lessons"] = new_lessons
    return state
