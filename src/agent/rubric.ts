/**
 * What a good answer looks like — the one copy, shared by every prompt that
 * needs it.
 *
 * It lives here rather than inside a prompt because two prompts with a list
 * each will drift, and the moment they disagree the loop starts undoing
 * itself: one node spends a pass adding what the other was told to cut. The
 * word count was already stated in both the responder's prompt and the draft
 * schema before this file was filled in — that is the drift starting.
 */
export const ANSWER_RUBRIC = `- Answer the question that was asked, first sentence. No preamble.
- ~250 words unless the question genuinely needs more. Depth over breadth.
- Prefer specifics — numbers, dates, names — over summary adjectives.
- Say plainly when something is uncertain or disputed. A hedge with a reason
  beats false confidence, and beats refusing to answer.
- No filler openers, no restating the question back.
- Plain prose and short paragraphs.`;
