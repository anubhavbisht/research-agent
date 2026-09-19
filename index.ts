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
                // Per-question working state (a revision count, gathered
                // evidence) is reset here once those channels exist — the
                // checkpointer persists the whole thread, so a counter left
                // alone ends every later turn before it starts.
                const result = await app.invoke(
                    { messages: [{ role: "user", content: question }] },
                    config,
                );

                // The answer channel, not the last message: the draft lives
                // in its own channel so revisions never enter the transcript.
                console.log(`\nAI: ${result.answer}\n`);

                // Visible while the revisor is missing — this is the evidence
                // that will be rewritten against once that node lands.
                if (result.evidence.length > 0) {
                    console.log("Sources found:");
                    for (const e of result.evidence) console.log(`  - ${e.title}\n    ${e.url}`);
                    console.log();
                }

                console.log(`[searched: ${result.queries.join(" | ")}]\n`);
            } catch (e) {
                console.error("AI:  Something went wrong:", (e as Error).message);
            }
        }
    } finally {
        rl.close();
    }
}

main();
