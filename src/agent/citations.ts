import type { Evidence } from "./state";

/**
 * Checking that the answer's citations point at sources that exist.
 *
 * The revisor is asked to copy URLs out of the evidence, and mostly it does —
 * but "mostly" is the problem. A model that invents a plausible URL, or cites
 * [7] when six sources were supplied, produces an answer that looks sourced
 * and is not. Nothing else in the loop would catch it: the verdict is the same
 * model's opinion of its own work.
 *
 * Pure functions, so they are testable without an API key.
 */

/** Every `[n]` marker in the prose, in order of appearance, deduplicated. */
export function citedMarkers(answer: string): number[] {
    const markers = [...answer.matchAll(/\[(\d+)\]/g)].map((m) => Number(m[1]));
    return [...new Set(markers)];
}

export type CitationCheck = {
    /** The claimed URLs that really are in the evidence, in the order given. */
    citations: string[];
    /** Claimed URLs that appear nowhere in the evidence — invented, or mangled. */
    unknown: string[];
    /** `[n]` markers with no matching evidence item, e.g. [7] of 6 sources. */
    dangling: number[];
};

export function checkCitations(answer: string, claimed: string[], evidence: Evidence[]): CitationCheck {
    const known = new Set(evidence.map((e) => e.url));

    const citations: string[] = [];
    const unknown: string[] = [];
    for (const url of claimed) {
        (known.has(url) ? citations : unknown).push(url);
    }

    // Markers are 1-based indices into the evidence list the revisor was shown.
    const dangling = citedMarkers(answer).filter((n) => n < 1 || n > evidence.length);

    return { citations, unknown, dangling };
}
