import { expect, test } from "bun:test";
import { MAX_REVISIONS, needsMoreResearch } from "./predicates";
import type { GraphState } from "./state";

/**
 * The predicate reads three channels. Everything else on GraphState is filler
 * here, so the helper supplies defaults and each test names only what it is
 * actually about — a test that spells out the whole state hides its own point.
 */
const state = (over: Partial<GraphState> = {}) =>
    ({
        messages: [],
        answer: "an answer",
        reflection: { missing: "", superfluous: "" },
        queries: ["a query"],
        evidence: [],
        citations: [],
        revisions: 0,
        verdict: "REVISE",
        ...over,
    }) as GraphState;

test("a grounded answer ends the turn on the first pass", () => {
    expect(needsMoreResearch(state({ verdict: "GROUNDED", revisions: 1 }))).toBe("finalize");
});

test("an unsatisfied revisor with queries goes back for more research", () => {
    expect(needsMoreResearch(state({ verdict: "REVISE", queries: ["something"] }))).toBe("research");
});

test("no queries ends the turn even when the revisor is unsatisfied", () => {
    // Another round would run an empty search and hand the revisor the same
    // evidence, so it would reach the same verdict forever.
    expect(needsMoreResearch(state({ verdict: "REVISE", queries: [] }))).toBe("finalize");
});

test("the revision cap ends the turn", () => {
    expect(needsMoreResearch(state({ verdict: "REVISE", revisions: MAX_REVISIONS }))).toBe("finalize");
});

test("the cap is a floor, not an equality — an overshoot still stops", () => {
    expect(needsMoreResearch(state({ verdict: "REVISE", revisions: MAX_REVISIONS + 5 }))).toBe("finalize");
});

test("the last allowed pass still researches", () => {
    expect(needsMoreResearch(state({ verdict: "REVISE", revisions: MAX_REVISIONS - 1 }))).toBe("research");
});

test("the verdict wins over a remaining budget", () => {
    // The early exit is the point: a sourced answer must not spend the budget
    // just because the budget is there.
    expect(needsMoreResearch(state({ verdict: "GROUNDED", revisions: 0 }))).toBe("finalize");
});
