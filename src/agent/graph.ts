import { MemorySaver, START, StateGraph } from "@langchain/langgraph";
import { StateAnnotation } from "./state";

/**
 * Node and edge wiring, and nothing else — no prompts, no tools, no logic.
 *
 * The Reflexion shape this is heading for:
 *
 *   START -> responder -> research -> revisor -> (research | finalize) -> END
 *
 * Each node is `.addNode(name, fn)` with the function imported from its own
 * folder; the loop back from the revisor is `.addConditionalEdges` with a
 * predicate from `./predicates`.
 */
const graph = new StateGraph(StateAnnotation)
    // .addNode("responder", responderAgent)
    .addEdge(START, "__end__");

// The checkpointer is what makes a thread_id remember earlier turns.
export const app = graph.compile({ checkpointer: new MemorySaver() });
