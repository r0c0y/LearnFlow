import json
import os
from typing import Generator
from langgraph.graph import StateGraph, END
from agents.architect_agent import run_architect_agent
from agents.content_agent import run_content_agent
from agents.student_agent import run_student_agent
from agents.evaluator import run_evaluator

def should_loop(state: dict) -> str:
    iteration = state.get("iteration", 0)
    max_iter = state.get("max_iterations", 1)
    all_passed = state.get("all_passed", True)
    if all_passed or iteration >= max_iter - 1:
        return "complete"
    return "refine"

def increment_iteration(state: dict) -> dict:
    state["iteration"] = state.get("iteration", 0) + 1
    return state

def mark_complete(state: dict) -> dict:
    state["status"] = "complete"
    return state

def build_pipeline():
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
    graph.add_conditional_edges("evaluator", should_loop, {"complete": "complete", "refine": "increment"})
    graph.add_edge("increment", "architect")
    graph.add_edge("complete", END)
    return graph.compile()

_pipeline = None
def get_pipeline():
    global _pipeline
    if _pipeline is None:
        _pipeline = build_pipeline()
    return _pipeline

def run_pipeline_with_events(initial_state: dict) -> Generator[str, None, None]:
    def sse(stage: str, message: str, data: dict = None) -> str:
        payload = {"stage": stage, "message": message}
        if data: payload["data"] = data
        return f"data: {json.dumps(payload)}\n\n"

    yield sse("ingesting", "Preparing your lesson...")
    
    state = dict(initial_state)
    state.setdefault("iteration", 0)
    state.setdefault("max_iterations", 1)
    
    pipeline = get_pipeline()
    
    # Simple loop: just report which stage finished
    for step in pipeline.stream(state):
        node_name = list(step.keys())[0]
        node_output = list(step.values())[0]
        
        if node_name == "complete":
            yield sse("complete", "Success!", {"lessons": node_output.get("lessons", [])})
        else:
            yield sse(node_name, f"Completed {node_name} stage...")
