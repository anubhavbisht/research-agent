import { ChatOpenAI } from "@langchain/openai";
import { env } from "../config";

/**
 * The shared chat model. Temperature 0 keeps routing and self-critique
 * deterministic — the same question takes the same path through the graph
 * every run, which is the only way a loop like this is debuggable.
 *
 * One model for both nodes on purpose: a cheaper critic is a worse critic, and
 * a critic that misses a gap costs a whole extra round to discover.
 * `MODEL` is the single line to change to trade cost against quality.
 */
const MODEL = "gpt-4.1-mini";

export const model = new ChatOpenAI({
    apiKey: env.OPENAI_API_KEY,
    model: MODEL,
    temperature: 0,
});
