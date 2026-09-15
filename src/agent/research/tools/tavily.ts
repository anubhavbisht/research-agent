import { TavilySearchAPIWrapper } from "@langchain/tavily";
import { env } from "../../../config";

/**
 * Internal to `research/tools`. Nothing outside that folder imports this file —
 * the folder's `index.ts` is the public API, so swapping Tavily for another
 * provider is a change in here and nowhere else.
 */

/** Results per query. Past ~5 the extra hits are near-duplicates that only cost context. */
const RESULTS_PER_QUERY = 4;

/**
 * Constructed once at module load, but it opens no connection — the wrapper
 * only holds the key until a call is made, so importing this module stays free.
 */
const client = new TavilySearchAPIWrapper({ tavilyApiKey: env.TAVILY_API_KEY });

export async function searchOne(query: string) {
    const response = await client.rawResults({
        query,
        max_results: RESULTS_PER_QUERY,
        search_depth: "basic",
    });

    return response.results.map((result) => ({
        title: result.title,
        url: result.url,
        content: result.content,
        // The query that surfaced it — lets a node see which gap a source fills.
        query,
    }));
}
