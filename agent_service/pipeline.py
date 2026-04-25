import json
import os
from typing import Generator
from langgraph.graph import StateGraph, END
from agents.architect_agent import run_architect_agent
from agents.content_agent import run_content_agent
from agents.student_agent import run_student_agent
from agents.evaluator import run_evaluator


def should_loop(state: dict) -> str:
    """Decide whether to loop or finish after evaluation."""
    iteration = state.get("iteration", 0)
    max_iter = state.get("max_iterations", int(os.getenv("MAX_ITERATIONS", "1")))
    all_passed = state.get("all_passed", True)

    if all_passed or iteration >= max_iter - 1:
        return "complete"
    return "refine"


def increment_iteration(state: dict) -> dict:
    state["iteration"] = state.get("iteration", 0) + 1
    return state


def mark_complete(state: dict) -> dict:
    # Flag review_needed on persistently failing lessons
    failure_ids = {fl["lesson_id"] for fl in state.get("failure_logs", [])}
    for lesson in state.get("lessons", []):
        if lesson.get("lesson_id") in failure_ids:
            lesson["review_needed"] = True
    state["status"] = "complete"
    return state


def build_pipeline():
    """Build and compile the LangGraph state machine."""
    graph = StateGraph(dict)

    graph.add_node("architect", run_architect_agent)
    graph.add_node("content", run_content_agent)
    graph.add_node("student", run_student_agent)
    graph.add_node("evaluator", run_evaluator)
    graph.add_node("increment", increment_iteration)
    graph.add_node("complete", mark_complete)

    graph.set_entry_point("architect")
    graph.add_edge("architect", "content")
    graph.add_edge("content", "student")
    graph.add_edge("student", "evaluator")
    graph.add_conditional_edges(
        "evaluator",
        should_loop,
        {"complete": "complete", "refine": "increment"},
    )
    graph.add_edge("increment", "architect")
    graph.add_edge("complete", END)

    return graph.compile()


# Singleton pipeline
_pipeline = None


def get_pipeline():
    global _pipeline
    if _pipeline is None:
        _pipeline = build_pipeline()
    return _pipeline


def run_pipeline_with_events(initial_state: dict) -> Generator[str, None, None]:
    """
    Run the full pipeline and yield SSE-formatted strings at each stage.
    This is a generator that streams progress events to the client.
    """
    def sse(stage: str, message: str, data: dict = None) -> str:
        payload = {"stage": stage, "message": message}
        if data:
            payload["data"] = data
        return f"data: {json.dumps(payload)}\n\n"

    yield sse("ingesting", "Reading your document...")
    yield sse("chunking", "Breaking content into sections...")

    state = dict(initial_state)
    state.setdefault("iteration", 0)
    state.setdefault("max_iterations", int(os.getenv("MAX_ITERATIONS", "1")))
    state.setdefault("status", "generating")
    state.setdefault("failure_logs", [])
    state.setdefault("student_results", [])
    state.setdefault("lessons", [])

    pipeline = get_pipeline()

    # Stream through pipeline stages
    for step in pipeline.stream(state):
        node_name = list(step.keys())[0]
        node_state = list(step.values())[0]

        if node_name == "architect":
            yield sse("architect", "Designing lesson structure...")
        elif node_name == "content":
            yield sse("content", "Writing lesson content...")
        elif node_name == "student":
            yield sse("testing", "Testing with simulated student...")
        elif node_name == "evaluator":
            iteration = node_state.get("iteration", 0)
            passed = node_state.get("all_passed", True)
            if passed:
                yield sse("refining", "Finalizing lessons...")
            else:
                yield sse("refining", f"Refining iteration {iteration + 1} of {node_state.get('max_iterations', 3)}...")
        elif node_name == "complete":
            final_state = node_state
            yield sse("complete", "Your lesson is ready!", {
                "lessons": final_state.get("lessons", []),
                "blueprint": final_state.get("blueprint", {}),
                "evaluation_results": final_state.get("evaluation_results", []),
                "iterations_needed": final_state.get("iteration", 0),
                "status": "complete",
            })
