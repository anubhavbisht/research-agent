import { TavilyExtract } from "@langchain/tavily";
import { env } from "../../../config";
import type { Evidence } from "../../state";

/**
 * Internal to `research/tools`.
 *
 * Search returns a snippet — a few hundred characters chosen by a relevance
 * ranker, which is enough to know a page is on topic and rarely enough to
 * answer with. An answer built only from snippets can be no more specific
 * than a search preview, which is why the drafts kept hedging about version
 * numbers that were sitting in the pages themselves.
 *
 * So the strongest few pages get read properly. Only a few, because full text
 * is one to two orders of magnitude larger than a snippet and it all ends up
 * in the revisor's prompt.
 */

/** Pages read in full per round. The cost of this step is almost entirely here. */
const PAGES_TO_READ = 3;

/** Characters kept per page. Enough for the substance, short of a whole manual. */
const FULL_TEXT_LIMIT = 4000;

const client = new TavilyExtract({ tavilyApiKey: env.TAVILY_API_KEY });

function failed(output: unknown): output is { error: string } {
    return typeof output === "object" && output !== null && "error" in output;
}

/**
 * Replaces the snippet with the page body for the first few items. Order is
 * the caller's relevance order; evidence that is not read keeps its snippet,
 * so this can fail completely and the round still produces usable sources.
 */
export async function readInFull(evidence: Evidence[]): Promise<Evidence[]> {
    const targets = evidence.slice(0, PAGES_TO_READ).map((e) => e.url);
    if (targets.length === 0) return evidence;

    const output = await client.invoke({ urls: targets });

    if (failed(output)) {
        console.warn(`  [full-text read failed] ${output.error}`);
        return evidence;
    }

    // Keyed by URL rather than by position: Tavily drops pages it cannot
    // fetch, so the results do not line up with the requests.
    const bodies = new Map<string, string>();
    for (const result of output.results ?? []) {
        if (result.raw_content) bodies.set(result.url, result.raw_content);
    }

    return evidence.map((item) => {
        const body = bodies.get(item.url);
        return body ? { ...item, content: body.slice(0, FULL_TEXT_LIMIT) } : item;
    });
}
