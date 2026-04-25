import json
from groq_client import call_llm, HEAVY_MODEL


EVALUATOR_SYSTEM = """You are a strict but fair academic evaluator.
Compare the student's attempt against the solution and rubric.
Score 0-100. Be honest — partial credit is fine, but don't be generous with wrong answers.

Return JSON:
{
  "lesson_id": "L1",
  "passed": true or false (passed = score >= 65),
  "score": 0-100,
  "errors": ["specific description of what was wrong"],
  "missing_concepts": ["concept the student clearly did not understand"]
}"""


def run_evaluator(state: dict) -> dict:
    """Evaluate student results against lesson solutions."""
    lessons = state.get("lessons", [])
    student_results = state.get("student_results", [])
    failure_logs = state.get("failure_logs", [])
    iteration = state.get("iteration", 0)
    failed_ids = {fl["lesson_id"] for fl in failure_logs} if iteration > 0 else set()

    lesson_map = {l["lesson_id"]: l for l in lessons}
    result_map = {r["lesson_id"]: r for r in student_results}

    new_failure_logs = []
    all_evaluations = []
    all_passed = True

    for lid, lesson in lesson_map.items():
        student_result = result_map.get(lid)
        if not student_result:
            continue

        # Skip re-evaluation of already-passing lessons
        if iteration > 0 and lid not in failed_ids:
            prev_eval = next((e for e in state.get("evaluation_results", []) if e["lesson_id"] == lid), None)
            if prev_eval:
                all_evaluations.append(prev_eval)
                if not prev_eval.get("passed", True):
                    all_passed = False
                continue

        assessment = lesson.get("assessment", {})
        exercise = lesson.get("exercise", {})
        assess_type = assessment.get("type", "mcq")

        # MCQ: exact string match first
        if assess_type == "mcq":
            student_ans = str(student_result.get("assessment_answer", "")).strip().upper()
            correct = str(assessment.get("correct_answer", "")).strip().upper()
            # Check if the first letter matches (e.g., "A" matches "A. option text")
            student_first = student_ans[0] if student_ans else ""
            correct_first = correct[0] if correct else ""
            if student_first == correct_first and student_first:
                eval_result = {
                    "lesson_id": lid,
                    "passed": True,
                    "score": 90,
                    "errors": [],
                    "missing_concepts": student_result.get("confusion_points", []),
                }
                all_evaluations.append(eval_result)
                continue

        user_msg = f"""
Lesson title: {lesson.get("title")}
Assessment type: {assess_type}

Exercise:
Instructions: {exercise.get("instructions", "")}
Student attempt: {student_result.get("exercise_attempt", "")}
Solution: {exercise.get("solution", "")}

Assessment question: {assessment.get("question", "")}
Student answer: {student_result.get("assessment_answer", "")}
Correct answer: {assessment.get("correct_answer", "")}
Rubric: {assessment.get("rubric", "")}

Student confusion points: {student_result.get("confusion_points", [])}
"""
        raw = call_llm(HEAVY_MODEL, EVALUATOR_SYSTEM, user_msg, max_tokens=800)
        eval_result = json.loads(raw)
        eval_result["lesson_id"] = lid
        all_evaluations.append(eval_result)

        if not eval_result.get("passed", False):
            all_passed = False
            new_failure_logs.append({
                "lesson_id": lid,
                "errors": eval_result.get("errors", []),
                "missing_concepts": eval_result.get("missing_concepts", []),
                "confusion_points": student_result.get("confusion_points", []),
                "score": eval_result.get("score", 0),
            })

    state["evaluation_results"] = all_evaluations
    state["failure_logs"] = new_failure_logs
    state["all_passed"] = all_passed

    return state
