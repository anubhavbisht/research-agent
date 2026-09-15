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

                console.log(`\nAI: ${result.messages.at(-1)?.text}\n`);
            } catch (e) {
                console.error("AI:  Something went wrong:", (e as Error).message);
            }
        }
    } finally {
        rl.close();
    }
}

main();
