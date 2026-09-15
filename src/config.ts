import { z } from "zod";

/**
 * The single inventory of every environment variable this app reads.
 *
 * Importing this module validates the environment as a side effect, so it is
 * imported first in `index.ts` — a missing key throws here, at startup, with a
 * readable message, instead of surfacing later as a 401 from a provider.
 */
const EnvSchema = z.object({
    OPENAI_API_KEY: z.string().min(1, "required — https://platform.openai.com/api-keys"),
    TAVILY_API_KEY: z.string().min(1, "required — https://app.tavily.com/home"),

    // The LangSmith SDK reads these from process.env itself; they are declared
    // here so this file stays a complete picture of the app's configuration.
    LANGSMITH_TRACING: z.stringbool().optional(),
    LANGSMITH_ENDPOINT: z.url().optional(),
    LANGSMITH_API_KEY: z.string().optional(),
    LANGSMITH_PROJECT: z.string().optional(),
});

const parsed = EnvSchema.safeParse(process.env);

if (!parsed.success) {
    const issues = parsed.error.issues
        .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
        .join("\n");
    throw new Error(`Invalid environment. Compare your .env with .env.example:\n${issues}`);
}

export const env = parsed.data;
