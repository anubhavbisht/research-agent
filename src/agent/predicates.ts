import { END } from "@langchain/langgraph";
import type { GraphState } from "./state";

/**
 * Branch conditions for the graph's conditional edges. A predicate reads state
 * and returns the name of the next node — it never mutates state and never
 * calls a model. Anything that does belongs in a node.
 *
 * Pure functions on purpose: this is the only logic in the graph that can be
 * tested without an API key.
 */

/**
 * How many times one question may go back for another round of research.
 *
 * The revisor is a model judging its own work and can always name one more
 * thing it is unsure of, so the loop needs a stop from outside. Each round
 * costs a model call plus up to three searches.
 */
export const MAX_REVISIONS = 3;

/**
 * Another round of research, or is the answer done?
 *
 * Three ways out, in order of what they mean:
 * - the revisor says every claim is carried by a source. The intended exit,
 *   and the reason a well-sourced question costs one round instead of the
 *   whole budget;
 * - it wants more but named nothing to search for, so another round would run
 *   the same queries against the same pages and reach the same verdict;
 * - the budget is spent. The backstop, not the normal path.
 */
export function needsMoreResearch(state: GraphState) {
    if (state.verdict === "GROUNDED") return END;
    if (state.queries.length === 0) return END;
    if (state.revisions >= MAX_REVISIONS) return END;
    return "research";
}
