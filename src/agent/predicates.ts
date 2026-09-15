/**
 * Branch conditions for the graph's conditional edges. A predicate reads state
 * and returns the name of the next node — it never mutates state and never
 * calls a model. Anything that does belongs in a node.
 *
 * Pure functions on purpose: this is the only logic in the graph that can be
 * tested without an API key.
 *
 * The loop back from the revisor needs one of these, and it needs a cap
 * (`MAX_REVISIONS`) alongside an early exit on the verdict — the cap is the
 * backstop for a model that is never satisfied, not the normal way out.
 */
export {};
