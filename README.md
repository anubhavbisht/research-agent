# research-agent

Answers research questions with sources, using the **Reflexion** pattern.

One researcher writes an answer, criticises its own answer, searches the web
for what it said was missing, then rewrites against what it found — looping
until every claim rests on a source or the revision budget runs out.

Built with LangGraph on [Bun](https://bun.com), with OpenAI for inference and
Tavily for search.

> **Status: in progress.** The environment, the model, the search client, the
> rubric, the draft contract and the `responder` node exist. The graph is not
> wired yet — see [To build](#to-build).

## Reflexion, and how it differs from reflection

A reflection loop is two models: a writer and a critic that judges it. Reflexion
is *one* model that produces, in a single call, three things at once:

```
answer + critique-of-that-answer + the searches that would fix it
```

Two consequences follow, and they are the reason to prefer it here:

- **The critique is actionable.** Split it into `missing` / `superfluous` and
  the next round gets a search list rather than an opinion.
- **The loop can be grounded.** The stopping condition becomes "every claim is
  carried by a source I now hold", which only the node holding the evidence can
  judge. A separate critic can only say whether prose reads well.

## The shape to build toward

```
             question
                │
                ▼
        ┌───────────────┐
        │   responder   │   unsourced answer + self-critique + queries
        └───────────────┘
                │
                ▼
        ┌───────────────┐
        │   research    │◄─────────┐   Tavily
        └───────────────┘          │
                │ evidence         │ REVISE: the gaps become the next queries
                ▼                  │
        ┌───────────────┐          │
        │    revisor    │──────────┘   rewrite + cite + re-critique + verdict
        └───────────────┘
                │ GROUNDED, or the revision cap
                ▼
               END
```

The responder always searches at least once — its draft is unsourced by
construction, so there is no honest verdict to branch on yet.

## Setup

Requires [Bun](https://bun.com) 1.3+.

```bash
bun install
cp .env.example .env    # then fill in OPENAI_API_KEY and TAVILY_API_KEY
```

[config.ts](src/config.ts) validates the environment at startup, so a missing
key fails immediately with a readable message rather than as a 401 from a
provider later.

| variable | required | purpose |
|---|---|---|
| `OPENAI_API_KEY` | yes | `gpt-4.1-mini` ([platform.openai.com](https://platform.openai.com/api-keys)) |
| `TAVILY_API_KEY` | yes | web search ([app.tavily.com](https://app.tavily.com/home)) |
| `LANGSMITH_*` | no | tracing |

## Scripts

| command | what it does |
|---|---|
| `bun run dev` | start the CLI |
| `bun test` | run the tests |
| `bun run typecheck` | `tsc --noEmit` |

## Project structure

```
index.ts                     CLI; imports config first so env fails fast
src/
  config.ts                  validated environment — the app's full env inventory
  agent/
    graph.ts                 node + edge wiring, nothing else
    predicates.ts            branch conditions for conditional edges
    state.ts                 state schema + the enums that close the routing
    schemas.ts               the Reflexion output contract, shared by both nodes
    llm.ts                   the OpenAI chat model
    rubric.ts                what a good answer looks like — shared by both prompts
    responder/               first unsourced answer + self-critique + queries
    research/
      tools/tavily.ts        the search client
```

A specialist is added as its own folder — `src/agent/<name>/index.ts` for the
node, `src/agent/<name>/tools/` for its tools. `graph.ts` then imports one name
per specialist and stays unaware of how that folder is laid out inside.
`CLAUDE.md` has the full set of conventions.

## To build

Roughly in dependency order. Done so far:

1. ~~**`state.ts`**~~ — `answer`, `reflection` and `queries` channels, plus
   `ReflectionSchema`. Still needs `evidence`, `revisions` and a `VerdictSchema`
   (`GROUNDED` / `REVISE`) — the enum types the channel *and* constrains what
   the model may emit.
2. ~~**`rubric.ts`**~~ — the rules both prompts build on.
3. ~~**`schemas.ts`**~~ — `DraftSchema`. Still needs the revision shape: the
   same fields plus `citations` and `verdict`.
4. ~~**`responder/`**~~ — one call returning answer + reflection + queries.

Remaining:

5. **`research/tools/index.ts`** — the public surface over `tavily.ts`; then
   **`research/index.ts`**, the node that runs the queries.
6. **`revisor/`** — rewrite against evidence, cite, re-critique, vote.
7. **`predicates.ts`** — `needsMoreResearch`, with `MAX_REVISIONS` beside it.
8. **`graph.ts`** — the nodes and the conditional edge back to `research`. Then
   `index.ts` reads `result.answer` rather than the last message.

Worth deciding early, because they are awkward to retrofit:

- **Does `evidence` accumulate or replace?** A later answer still rests on
  sources the first round found. Accumulating needs deduplication by URL and a
  ceiling — it is the largest thing in the prompt and it only grows.
- **Does the answer live in `messages`?** Every revision landing in the
  transcript means a follow-up question arrives behind four drafts of the last
  one. A terminal node that writes the finished answer once is the way out.
- **How does the loop exit when the revisor wants more but names no queries?**
  Without a third exit, it re-runs the same round until the cap.
