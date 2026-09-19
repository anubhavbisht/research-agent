import { END, MemorySaver, START, StateGraph } from "@langchain/langgraph";
import { researchAgent } from "./research";
import { responderAgent } from "./responder";
import { StateAnnotation } from "./state";

/**
 * Node and edge wiring, and nothing else — no prompts, no tools, no logic.
 *
 * The Reflexion shape this is heading for:
 *
 *   START -> responder -> research -> revisor -> (research | finalize) -> END
 *
 * Today the turn ends once research has run, so the answer on screen is still
 * the responder's unsourced draft — the evidence is gathered but nothing
 * rewrites against it yet. `revisor` is the next node to land, and the loop
 * back from it will be `.addConditionalEdges` with a predicate from
 * `./predicates`.
 */
const graph = new StateGraph(StateAnnotation)
    .addNode("responder", responderAgent)
    .addNode("research", researchAgent)
    .addEdge(START, "responder")
    // The responder always searches at least once: its draft is unsourced by
    // construction, so there is no honest verdict to branch on yet.
    .addEdge("responder", "research")
    .addEdge("research", END);

// The checkpointer is what makes a thread_id remember earlier turns.
export const app = graph.compile({ checkpointer: new MemorySaver() });
