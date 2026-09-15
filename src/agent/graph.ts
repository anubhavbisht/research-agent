import { END, MemorySaver, START, StateGraph } from "@langchain/langgraph";
import { responderAgent } from "./responder";
import { StateAnnotation } from "./state";

/**
 * Node and edge wiring, and nothing else — no prompts, no tools, no logic.
 *
 * The Reflexion shape this is heading for:
 *
 *   START -> responder -> research -> revisor -> (research | finalize) -> END
 *
 * Today the responder runs alone, so the turn ends on an unsourced draft and
 * the queries it asked for go nowhere. `research` is the next node to land;
 * the loop back from the revisor will be `.addConditionalEdges` with a
 * predicate from `./predicates`.
 */
const graph = new StateGraph(StateAnnotation)
    .addNode("responder", responderAgent)
    .addEdge(START, "responder")
    .addEdge("responder", END);

// The checkpointer is what makes a thread_id remember earlier turns.
export const app = graph.compile({ checkpointer: new MemorySaver() });
