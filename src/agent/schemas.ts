/**
 * The Reflexion contract: what each node in the loop hands back.
 *
 * The pattern's whole trick is that the answer, the critique of that answer,
 * and the searches that would fix it come out of *one* model call — so the
 * zod schema passed to `withStructuredOutput` is where the pattern actually
 * lives. Shared here because the draft and revision shapes differ by only a
 * field or two, and a field that drifts between them is a channel the graph
 * silently stops filling.
 */
export {};
