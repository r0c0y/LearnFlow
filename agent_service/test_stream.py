from langgraph.graph import StateGraph, END

def test_node1(state: dict) -> dict:
    state["lessons"] = ["lesson1"]
    return state

def mark_complete(state: dict) -> dict:
    state["status"] = "complete"
    return state

graph = StateGraph(dict)
graph.add_node("node1", test_node1)
graph.add_node("complete", mark_complete)
graph.set_entry_point("node1")
graph.add_edge("node1", "complete")
graph.add_edge("complete", END)
pipeline = graph.compile()

for step in pipeline.stream({}):
    print(step)
