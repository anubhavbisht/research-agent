import { Annotation, MessagesAnnotation } from "@langchain/langgraph";
import { z } from "zod";

/**
 * The graph's state. Every channel the loop needs gets added here first — the
 * annotation is what types the partial object each node returns, and what the
 * predicates read to decide a branch.
 *
 * Still to come, as the node that writes each one gets built: the evidence
 * research finds, a revision count, and the verdict the revisor votes with.
 */

/**
 * The self-critique half of Reflexion. It lives here rather than in
 * `schemas.ts` because it is the type of a state channel *and* part of the
 * model's output contract — one definition, or the two drift.
 *
 * The dependency runs one way: `schemas.ts` imports from here, never back.
 * `VerdictSchema` will have to live here too (routing enums do), so the other
 * direction would be a runtime circular import between the two files.
 */
export const ReflectionSchema = z.object({
    missing: z.string().describe("Critique of what is missing"),
    superfluous: z.string().describe("Critique of what is superfluous"),
});
export type Reflection = z.infer<typeof ReflectionSchema>;

/** Replaces the channel outright — the newest value is the only one that matters. */
export const replace = <T>(defaultValue: () => T) =>
    Annotation<T>({ reducer: (_previous, next) => next, default: defaultValue });

export const StateAnnotation = Annotation.Root({
    ...MessagesAnnotation.spec,

    /**
     * The answer as it currently stands. Kept out of `messages` on purpose:
     * every revision would otherwise land in the transcript, so a follow-up
     * question would arrive behind four drafts of the previous one.
     */
    answer: replace<string>(() => ""),

    /** The critique the last node wrote about `answer`. Drives the next search round. */
    reflection: replace<Reflection>(() => ({ missing: "", superfluous: "" })),

    /** Searches the last node asked for. Consumed by `research`, then overwritten. */
    queries: replace<string[]>(() => []),
});

export type GraphState = typeof StateAnnotation.State;
