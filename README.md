# research-agent

Answers research questions with sources, using the **Reflexion** pattern.

One researcher writes an answer, criticises its own answer, searches the web
for what it said was missing, then rewrites against what it found — looping
until every claim rests on a source or the revision budget runs out.

Built with LangGraph on [Bun](https://bun.com), with OpenAI for inference and
Tavily for search.

> **Status: the loop closes.** All three nodes are built and wired, so a turn
> drafts, searches, rewrites against the sources and decides whether to go
> again. What is left is polish — see [To build](#to-build).

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
                │ GROUNDED, no queries left, or the cap
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
    research/                runs the queries, appends what it finds
      tools/tavily.ts        the search client
    revisor/                 rewrites against evidence, cites, re-critiques, votes
```

A specialist is added as its own folder — `src/agent/<name>/index.ts` for the
node, `src/agent/<name>/tools/` for its tools. `graph.ts` then imports one name
per specialist and stays unaware of how that folder is laid out inside.
`CLAUDE.md` has the full set of conventions.

## To build

Done:

1. ~~**`state.ts`**~~ — every channel: `answer`, `reflection`, `queries`,
   `evidence`, `citations`, `revisions`, `verdict`. Plus `ReflectionSchema` and
   `VerdictSchema`.
2. ~~**`rubric.ts`**~~ — the rules both prompts build on.
3. ~~**`schemas.ts`**~~ — `DraftSchema` and `RevisionSchema`.
4. ~~**`responder/`**~~ — one call returning answer + reflection + queries.
5. ~~**`research/`**~~ — the node, its tool surface, and the accumulating,
   URL-deduplicated `evidence` reducer.
6. ~~**`revisor/`**~~ — rewrites against evidence, cites, re-critiques, votes.
7. ~~**`predicates.ts`**~~ — `needsMoreResearch` with `MAX_REVISIONS`.
8. ~~**`graph.ts`**~~ — the conditional edge back to `research`.

Remaining:

- **A terminal node.** Nothing writes the finished answer into `messages`, so
  the thread remembers the questions but not the answers, and a follow-up like
  "expand on the second point" has no idea what that was.
- **Tests.** `predicates.ts` is the natural first target — the only logic in
  the graph that runs without an API key.
- **Streaming.** `app.invoke` returns only when the whole loop is done, so a
  two-round question is a silent minute.
- **Full-text reads.** Only Tavily's snippets are used, so an answer can only
  be as specific as a search preview. `TavilyExtract` on the top few URLs would
  fix that.
- **Citation checking.** Nothing verifies a `[n]` marker points at a source
  that actually says it.
- **Persistence.** `MemorySaver` keeps conversations in process memory.


