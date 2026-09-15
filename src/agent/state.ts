import { Annotation, MessagesAnnotation } from "@langchain/langgraph";

/**
 * The graph's state. Every channel the loop needs gets added here first — the
 * annotation is what types the partial object each node returns, and what the
 * predicates read to decide a branch.
 *
 * Reflexion needs at least an answer, a critique of it, the searches it asked
 * for, the evidence they found, and a revision count. Add them one at a time,
 * as the node that writes each one gets built.
 */
export const StateAnnotation = Annotation.Root({
    ...MessagesAnnotation.spec,
});

export type GraphState = typeof StateAnnotation.State;
