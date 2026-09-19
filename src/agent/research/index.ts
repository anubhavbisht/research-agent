import type { GraphState } from "../state";
import { searchAll } from "./tools";

/**
 * The only node in the graph that touches the outside world, and the only one
 * that calls no model. It runs whatever queries the last node asked for and
 * appends what it finds; the `evidence` reducer owns deduplication and the
 * ceiling, so this node stays a straight pass-through.
 */
export async function researchAgent(state: GraphState) {
    // Nothing asked for. Returning an empty patch leaves every channel alone.
    if (state.queries.length === 0) return {};

    const evidence = await searchAll(state.queries);

    // An empty patch, not `{ evidence: [] }`: the reducer reads an explicit
    // empty array as "new question, clear the channel", so a round where every
    // query failed would wipe the sources earlier rounds found.
    if (evidence.length === 0) return {};

    return { evidence };
}
