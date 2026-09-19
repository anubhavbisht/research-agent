import { END, MemorySaver, START, StateGraph } from "@langchain/langgraph";
import { finalizeAgent } from "./finalize";
import { needsMoreResearch } from "./predicates";
import { researchAgent } from "./research";
import { responderAgent } from "./responder";
import { revisorAgent } from "./revisor";
import { StateAnnotation } from "./state";

/**
 * Node and edge wiring, and nothing else — no prompts, no tools, no logic.
 * The branch condition lives in `./predicates`, not in a closure here.
 */
const graph = new StateGraph(StateAnnotation)
    .addNode("responder", responderAgent)
    .addNode("research", researchAgent)
    .addNode("revisor", revisorAgent)
    .addNode("finalize", finalizeAgent)
    .addEdge(START, "responder")
    // The responder always searches at least once: its draft is unsourced by
    // construction, so there is no honest verdict to branch on yet.
    .addEdge("responder", "research")
    .addEdge("research", "revisor")
    // The branch sits after the revisor, not before it, so the verdict being
    // read is the one written about the answer that is actually on the table.
    .addConditionalEdges("revisor", needsMoreResearch, {
        research: "research",
        finalize: "finalize",
    })
    .addEdge("finalize", END);

// The checkpointer is what makes a thread_id remember earlier turns. In
// memory, so a conversation lives as long as the process does.
export const app = graph.compile({ checkpointer: new MemorySaver() });
