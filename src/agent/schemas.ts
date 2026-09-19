import { z } from "zod";
import { ReflectionSchema, VerdictSchema } from "./state";

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

/**
 * Searches one round may run. Enforced on the schema rather than left to the
 * description, because a description is a suggestion the model can ignore and
 * every extra query is another Tavily call. Three vague queries also return
 * much the same pages as two sharp ones.
 *
 * If `withStructuredOutput` is ever given `strict: true`, OpenAI rejects
 * `minItems`/`maxItems` and this cap has to move into the node.
 */
export const MAX_QUERIES_PER_ROUND = 3;

/** The opening attempt: answer from what the model already knows, then admit the gaps. */
export const DraftSchema = z.object({
    answer: z.string().describe("Detailed answer to the question, following the rubric."),
    reflection: ReflectionSchema,
    searchQueries: z
        .array(z.string())
        .min(1)
        .max(MAX_QUERIES_PER_ROUND)
        .describe(
            "Search queries for researching improvements to address the critique of your current answer.",
        ),
});
export type Draft = z.infer<typeof DraftSchema>;

/**
 * A revision, grounded in evidence. The draft's three fields plus the two that
 * only exist once there are sources on the table: what the answer cites, and
 * whether anything is still open.
 *
 * `citations` is a field rather than a "References:" block appended to the
 * answer text. Structured data in a string has to be parsed back out to be
 * counted, checked or rendered differently — and a prompt can only ask for a
 * format, while a schema guarantees it.
 */
export const RevisionSchema = z.object({
    answer: z.string().describe("The rewritten answer, with inline [n] citations."),
    reflection: ReflectionSchema,
    searchQueries: z
        .array(z.string())
        // No `.min(1)`, unlike the draft: a GROUNDED verdict means there is
        // nothing left to look up, and the schema has to allow saying so.
        .max(MAX_QUERIES_PER_ROUND)
        .describe("Searches for what is still missing. Empty when the verdict is GROUNDED."),
    citations: z
        .array(z.string())
        .describe("The URLs cited, in [n] order. Copy them exactly from the evidence."),
    verdict: VerdictSchema,
});
export type Revision = z.infer<typeof RevisionSchema>;
