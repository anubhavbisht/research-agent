import { HumanMessage, SystemMessage } from "langchain";
import { model } from "../llm";
import { ANSWER_RUBRIC } from "../rubric";
import { MAX_QUERIES_PER_ROUND, RevisionSchema } from "../schemas";
import type { Evidence, GraphState } from "../state";

/**
 * Built per call, not once at module load — as a module constant the timestamp
 * freezes at process start.
 */
const systemPrompt = () => `You are an expert researcher, revising your own previous answer against sources you just gathered.
Current time: ${new Date().toLocaleString("sv-SE")}

Write to these rules:
${ANSWER_RUBRIC}

How to revise:
- Start from the evidence, not from your draft. Where a source contradicts what
  you wrote, the source wins — say so rather than quietly softening the claim.
- Cut everything named in "superfluous". Cover everything named in "missing",
  or state plainly that the sources do not settle it.
- Cite inline as [n], where n is the number of the evidence item. Every number
  you use must exist in the list. Put those URLs in "citations", same order.
- Then critique this new answer the same way. It is a revision, not a final
  draft, and the next round depends on what you name here.

The verdict is yours, and it is not about polish:
- GROUNDED: every claim rests on a source in the evidence, and no further
  search would change the answer. Leave "searchQueries" empty.
- REVISE: something is still unsupported or unanswered. Put at most
  ${MAX_QUERIES_PER_ROUND} searches that would settle it in "searchQueries".`;

/** Numbered so the model can cite by index — [n] in the prose maps to this list. */
function formatEvidence(evidence: Evidence[]) {
    if (evidence.length === 0) return "(no sources found — say so in the answer)";

    return evidence
        .map((e, i) => `[${i + 1}] ${e.title}\n    ${e.url}\n    ${e.content}`)
        .join("\n\n");
}

/**
 * The second half of the loop: rewrite the answer against what research found,
 * critique the rewrite, and decide whether anything is still open.
 *
 * Note what is *not* here — no second model playing editor. The verdict comes
 * from the node that did the work, which is what separates Reflexion from a
 * plain writer/critic pair: the stopping condition is "the evidence supports
 * every claim", and only the node holding the evidence can judge that.
 */
export async function revisorAgent(state: GraphState) {
    // Nothing to revise. Bail rather than loop on an empty answer.
    if (!state.answer) {
        return { verdict: "GROUNDED" as const, revisions: state.revisions + 1 };
    }

    // The last human message is the question: no node injects messages of its
    // own, so the transcript holds only turns the user actually typed.
    const question = [...state.messages].reverse().find((m) => m.getType() === "human");

    const revision = await model.withStructuredOutput(RevisionSchema, { name: "revision" }).invoke([
        new SystemMessage(systemPrompt()),
        new HumanMessage(
            [
                `Question:\n${question?.text ?? "(no question given)"}`,
                `Your current answer:\n${state.answer}`,
                `Your own critique of it:\n- missing: ${state.reflection.missing}\n- superfluous: ${state.reflection.superfluous}`,
                `Evidence:\n${formatEvidence(state.evidence)}`,
            ].join("\n\n"),
        ),
    ]);

    return {
        answer: revision.answer,
        reflection: revision.reflection,
        // Queries are dropped on GROUNDED: the predicate ends the turn there,
        // and leaving them would feed a stale round if it ever did not.
        queries: revision.verdict === "REVISE" ? revision.searchQueries : [],
        citations: revision.citations,
        verdict: revision.verdict,
        revisions: state.revisions + 1,
    };
}
