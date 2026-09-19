import { TavilySearch } from "@langchain/tavily";
import { env } from "../../../config";
import type { Evidence } from "../../state";

/**
 * Internal to `research/tools`. Nothing outside that folder imports this file —
 * the folder's `index.ts` is the public API, so swapping Tavily for another
 * provider is a change in here and nowhere else.
 */

/**
 * Results kept per query. Two is thin for a research agent but cheap; raising
 * it is the first knob to reach for if answers feel under-sourced. Past ~5 the
 * extra hits are near-duplicates that only cost context.
 */
const RESULTS_PER_QUERY = 2;

/** Characters of each result kept. Tavily snippets run long; the lead carries the fact. */
const SNIPPET_LIMIT = 800;

/**
 * Constructed once at module load, but it opens no connection — the tool only
 * holds the key until a call is made, so importing this module stays free.
 *
 * The key comes from validated config rather than the tool's own
 * `process.env` fallback, so a missing key fails at startup with a readable
 * message instead of as a 401 in the middle of a turn.
 */
const client = new TavilySearch({
    maxResults: RESULTS_PER_QUERY,
    tavilyApiKey: env.TAVILY_API_KEY,
});

/**
 * `TavilySearch` catches everything and returns `{ error }` rather than
 * throwing — a 401, a rate limit and a query with no hits all arrive looking
 * like an ordinary response. Reading `.results || []` off one of those yields
 * an empty array and no signal, so a wrong API key silently becomes "I found
 * no sources". This guard is the only thing standing between that bug and you.
 */
function failed(output: unknown): output is { error: string } {
    return typeof output === "object" && output !== null && "error" in output;
}

export async function searchAll(queries: string[]): Promise<Evidence[]> {
    // batch() runs the queries in parallel — they are independent by
    // construction, and in series a three-query round is three round trips.
    const outputs = await client.batch(queries.map((query) => ({ query })));

    const evidence: Evidence[] = [];

    outputs.forEach((output, i) => {
        const query = queries[i] ?? "";

        if (failed(output)) {
            // One failed query is not a failed turn: the other queries' results
            // still stand. But it is said out loud, not swallowed.
            console.warn(`  [search failed: ${query}] ${output.error}`);
            return;
        }

        for (const result of output.results ?? []) {
            if (!result.url) continue;

            evidence.push({
                query,
                title: result.title || result.url,
                url: result.url,
                content: (result.content || "").slice(0, SNIPPET_LIMIT),
            });
        }
    });

    return evidence;
}
