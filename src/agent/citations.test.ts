import { expect, test } from "bun:test";
import { checkCitations, citedMarkers } from "./citations";
import type { Evidence } from "./state";

const source = (url: string): Evidence => ({ query: "q", title: url, url, content: "" });

test("markers are found in order and deduplicated", () => {
    expect(citedMarkers("First [2], then [1], then [2] again.")).toEqual([2, 1]);
});

test("prose with no markers has no citations", () => {
    expect(citedMarkers("No sources here at all.")).toEqual([]);
});

test("a URL present in the evidence is kept", () => {
    const result = checkCitations("Claim [1].", ["https://a.example"], [source("https://a.example")]);

    expect(result.citations).toEqual(["https://a.example"]);
    expect(result.unknown).toEqual([]);
});

test("an invented URL is separated out", () => {
    // The failure this whole module exists for: an answer that looks sourced
    // and is not. Nothing else in the loop would catch it, since the verdict
    // is the same model's opinion of its own work.
    const result = checkCitations("Claim [1].", ["https://invented.example"], [source("https://a.example")]);

    expect(result.citations).toEqual([]);
    expect(result.unknown).toEqual(["https://invented.example"]);
});

test("a marker numbered past the evidence is dangling", () => {
    const result = checkCitations("Claim [3].", [], [source("https://a.example")]);

    expect(result.dangling).toEqual([3]);
});

test("[0] is dangling — markers are 1-based", () => {
    expect(checkCitations("Claim [0].", [], [source("https://a.example")]).dangling).toEqual([0]);
});

test("markers within range are not dangling", () => {
    const evidence = [source("https://a.example"), source("https://b.example")];

    expect(checkCitations("One [1] and two [2].", [], evidence).dangling).toEqual([]);
});

test("no evidence makes every marker dangling", () => {
    expect(checkCitations("Claim [1].", ["https://a.example"], []).dangling).toEqual([1]);
});
