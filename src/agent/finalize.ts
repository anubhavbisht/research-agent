import { AIMessage } from "langchain";
import type { GraphState } from "./state";

/**
 * The turn's last node. It calls no model and makes no decision — its only job
 * is to put the finished answer into `messages`, so the thread's transcript is
 * the conversation the user had rather than every draft the loop produced.
 *
 * This is why intermediate answers live in the `answer` channel: without a
 * node that marks the end, the only way to keep history is to append each
 * revision, and by the third question a follow-up arrives behind a dozen
 * drafts of the first two. Without it at all — which is where this project sat
 * until now — the thread remembers the questions and none of the answers, so
 * "expand on the second point" has nothing to expand.
 *
 * Flat module rather than a folder under `agent/` because it is not a
 * specialist: no prompt, no tools, nothing to grow into a folder.
 */
export function finalizeAgent(state: GraphState) {
    return { messages: [new AIMessage(state.answer)] };
}
