// First import on purpose: validates the environment before any model is
// constructed, so a missing key fails here instead of inside a provider call.
import "./src/config";

import readline from "node:readline/promises";
import { app } from "./src/agent/graph";
import type { GraphState } from "./src/agent/state";

const EXIT_WORDS = ["bye", "exit", "quit"];

/** What each node says it is doing, printed as the loop runs. */
const PROGRESS: Record<string, (state: Partial<GraphState>) => string> = {
    responder: (s) => `drafted an answer, wants ${s.queries?.length ?? 0} search(es)`,
    research: (s) => `read ${s.evidence?.length ?? 0} source(s)`,
    revisor: (s) =>
        s.verdict === "GROUNDED"
            ? "revised — every claim is sourced"
            : `revised — still wants ${s.queries?.length ?? 0} search(es)`,
    finalize: () => "done",
};

async function main() {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

    // One thread per run — the checkpointer keys conversation memory on this
    // id, and keeps it in memory, so it lasts as long as the process.
    const config = { configurable: { thread_id: crypto.randomUUID() } };

    console.log("Research agent. Ask me something. Type 'bye' to leave.");

    // Iterating the interface rather than calling `rl.question()` in a loop:
    // question() only captures the line typed after it is called, so anything
    // arriving while the graph is running is emitted to nobody and lost. The
    // async iterator pauses the input stream between turns instead, which is
    // what makes a piped script behave like a person typing.
    rl.setPrompt("You: ");
    rl.prompt();

    try {
        for await (const line of rl) {
            const question = line.trim();

            if (!question) {
                rl.prompt();
                continue;
            }
            if (EXIT_WORDS.includes(question.toLowerCase())) break;

            try {
                console.log();

                let final: GraphState | undefined;

                // stream() rather than invoke(): a two-round question is a
                // silent minute otherwise, and there is no way to tell a slow
                // search from a hung process.
                for await (const step of await app.stream(
                    {
                        messages: [{ role: "user", content: question }],
                        // Per-question working state, reset here because the
                        // checkpointer persists the whole thread: a spent
                        // revision budget would end the next turn before its
                        // first round, and the last question's sources would
                        // get cited in an answer they have nothing to do with.
                        revisions: 0,
                        queries: [],
                        citations: [],
                        evidence: [],
                        verdict: "REVISE" as const,
                    },
                    { ...config, streamMode: "updates" },
                )) {
                    for (const [node, update] of Object.entries(step)) {
                        const patch = update as Partial<GraphState>;
                        console.log(`  ${node}: ${PROGRESS[node]?.(patch) ?? "done"}`);
                    }
                }

                // The stream yields patches, not the whole state. The finished
                // answer is read back from the checkpoint instead of stitched
                // together from updates.
                final = (await app.getState(config)).values as GraphState;

                console.log(`\nAI: ${final.answer}\n`);

                // Citations are a channel, not a "References:" block inside the
                // answer text — so the CLI can render them however it likes,
                // and a future UI can render them differently again.
                if (final.citations.length > 0) {
                    console.log("References:");
                    final.citations.forEach((url, i) => console.log(`  [${i + 1}] ${url}`));
                    console.log();
                }

                console.log(
                    `[${final.verdict.toLowerCase()} after ${final.revisions} revision(s), ${final.evidence.length} source(s) read]\n`,
                );
            } catch (e) {
                console.error("AI:  Something went wrong:", (e as Error).message);
            }

            rl.prompt();
        }
    } finally {
        rl.close();
    }
}

main();
