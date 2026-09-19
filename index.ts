// First import on purpose: validates the environment before any model is
// constructed, so a missing key fails here instead of inside a provider call.
import "./src/config";

import readline from "node:readline/promises";
import { app } from "./src/agent/graph";

const EXIT_WORDS = ["bye", "exit", "quit"];

async function main() {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    // One thread per run — the checkpointer keys conversation memory on this id.
    const config = {
        configurable: { thread_id: crypto.randomUUID() },
    };

    console.log("Research agent. Ask me something. Type 'bye' to leave.");

    try {
        while (true) {
            let question: string;
            try {
                question = (await rl.question("You: ")).trim();
            } catch {
                break;
            }

            if (!question) continue;
            if (EXIT_WORDS.includes(question.toLowerCase())) break;

            try {
                const result = await app.invoke(
                    {
                        messages: [{ role: "user", content: question }],
                        // Per-question working state, reset here because the
                        // checkpointer persists the whole thread: a spent
                        // revision budget would end the next turn before its
                        // first round, and last question's sources would get
                        // cited in an answer they have nothing to do with.
                        revisions: 0,
                        queries: [],
                        citations: [],
                        evidence: [],
                        verdict: "REVISE" as const,
                    },
                    config,
                );

                // The answer channel, not the last message: the draft lives
                // in its own channel so revisions never enter the transcript.
                console.log(`\nAI: ${result.answer}\n`);

                // Citations are a channel, not a "References:" block inside
                // the answer text — so the CLI can render them however it
                // likes, and a future UI can render them differently again.
                if (result.citations.length > 0) {
                    console.log("References:");
                    result.citations.forEach((url, i) => console.log(`  [${i + 1}] ${url}`));
                    console.log();
                }

                console.log(
                    `[${result.verdict.toLowerCase()} after ${result.revisions} revision(s), ${result.evidence.length} source(s) read]\n`,
                );
            } catch (e) {
                console.error("AI:  Something went wrong:", (e as Error).message);
            }
        }
    } finally {
        rl.close();
    }
}

main();
