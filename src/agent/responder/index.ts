import { SystemMessage } from "langchain";
import { model } from "../llm";
import { ANSWER_RUBRIC } from "../rubric";
import { DraftSchema, MAX_QUERIES_PER_ROUND } from "../schemas";
import type { GraphState } from "../state";

/**
 * Built per call, not once at module load. As a module constant the timestamp
 * freezes at process start, so a long-lived process tells the model it is
 * still yesterday — a bad failure in an agent whose job is current information.
 */
const systemPrompt = () => `You are an expert researcher.
Current time: ${new Date().toISOString()}

Write to these rules:
${ANSWER_RUBRIC}

1. Provide a detailed answer.
2. Reflect and critique your answer. Be severe to maximize improvement.
3. Recommend at most ${MAX_QUERIES_PER_ROUND} search queries to research information and improve your answer.

You have no sources yet, so answer from what you already know and do not invent
a citation. A reflection that says the answer is fine wastes the round that
follows it.`;

/**
 * The opening move of the Reflexion loop: an unsourced answer, an honest
 * account of what is wrong with it, and the searches that would fix it — all
 * from one model call, so the critique belongs to the node that wrote the
 * answer rather than to a second model judging from outside.
 */
export async function responderAgent(state: GraphState) {
    const draft = await model
        .withStructuredOutput(DraftSchema, { name: "draft" })
        .invoke([new SystemMessage(systemPrompt()), ...state.messages]);

    // Typed channels, not a JSON blob in a message: the next node reads
    // `state.queries` instead of parsing a string back into the shape
    // `withStructuredOutput` already guaranteed.
    return {
        answer: draft.answer,
        reflection: draft.reflection,
        queries: draft.searchQueries,
    };
}
