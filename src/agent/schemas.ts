import { z } from "zod";
import { ReflectionSchema } from "./state";

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
