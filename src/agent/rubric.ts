/**
 * What a good answer looks like — the one copy, shared by every prompt that
 * needs it.
 *
 * It lives here rather than inside a prompt because two prompts with a list
 * each will drift, and the moment they disagree the loop starts undoing
 * itself: one node spends a pass adding what the other was told to cut.
 */
export const ANSWER_RUBRIC = ``;
