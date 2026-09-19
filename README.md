# research-agent

Answers research questions with sources, using the **Reflexion** pattern.

One researcher drafts an answer from memory, criticises its own draft, searches
the web for what it admitted was missing, reads the strongest pages, and
rewrites — looping until every claim rests on a source or the revision budget
runs out.

Built with LangGraph on [Bun](https://bun.com), with OpenAI for inference and
Tavily for search and page extraction.

## Reflexion, and how it differs from reflection

A reflection loop is two models: a writer, and a critic that judges it.
Reflexion is *one* model that produces, in a single call, three things at once:

```
answer + critique-of-that-answer + the searches that would fix it
```

Two consequences follow, and they are the reason to prefer it here:

- **The critique is actionable.** It comes back split into `missing` and
  `superfluous`, so the next round has a search list rather than an opinion.
- **The loop can be grounded.** The stopping condition is *"every claim is
  carried by a source I now hold"* — a judgment only the node holding the
  evidence can make. A separate critic can tell you whether prose reads well;
  it cannot tell you whether a sentence is true.

## What that buys you

The same question, asked of the same model, at two points in the loop.

**The responder's first draft**, written from memory with no sources:

> LangGraph v1 introduced several key changes focused on enhancing the
> framework's ability to represent and manipulate language data as graph
> structures. Notably, it added support for **multi-modal data integration**,
> allowing nodes and edges to represent images and audio...

Fluent, confident, and almost entirely invented.

**After two rounds of search and revision:**

> LangGraph v1, released in October 2025, is a stability-focused update that
> preserves the core graph APIs and execution model unchanged [1][2]. A key
> change is the deprecation of the `createReactAgent` prebuilt in favour of
> LangChain's new `createAgent` API, which offers greater customization through
> middleware [2][3]. It also introduces typed interrupts... the release focuses
> on stabilizing the runtime **rather than adding new data modalities** [1][6].

That last clause is the loop explicitly retracting its own hallucination.

## How it works

```
             question
                │
                ▼
        ┌───────────────┐
        │   responder   │   unsourced draft + self-critique + queries
        └───────────────┘
                │
                ▼
        ┌───────────────┐
        │   research    │◄─────────┐   Tavily search, then read top pages in full
        └───────────────┘          │
                │ evidence         │ REVISE: the named gaps become the next queries
                ▼                  │
        ┌───────────────┐          │
        │    revisor    │──────────┘   rewrite + cite + re-critique + vote
        └───────────────┘
                │ GROUNDED, no queries left, or the revision cap
                ▼
        ┌───────────────┐
        │   finalize    │   the finished answer joins the transcript
        └───────────────┘
                │
                ▼
               END
```

The responder always searches at least once — its draft is unsourced by
construction, so there is no honest verdict to branch on yet.

`needsMoreResearch` in [predicates.ts](src/agent/predicates.ts) owns the exit,
and it has three ways out:

| exit | meaning |
|---|---|
| `verdict === "GROUNDED"` | every claim is carried by a source. The intended exit — a well-sourced question stops early instead of spending the whole budget |
| `queries.length === 0` | it wants more but named nothing to search for, so another round would repeat itself |
| `revisions >= MAX_REVISIONS` | the budget is spent. The backstop, not the normal path |

## Setup

Requires [Bun](https://bun.com) 1.3+.

```bash
bun install
cp .env.example .env    # then fill in OPENAI_API_KEY and TAVILY_API_KEY
```

[config.ts](src/config.ts) validates the environment at startup, so a missing
key fails immediately with a readable message rather than as a 401 from a
provider mid-turn.

| variable | required | purpose |
|---|---|---|
| `OPENAI_API_KEY` | yes | `gpt-4.1-mini` ([platform.openai.com](https://platform.openai.com/api-keys)) |
| `TAVILY_API_KEY` | yes | search + extract ([app.tavily.com](https://app.tavily.com/home)) |
| `LANGSMITH_*` | no | tracing |

## Running

```bash
bun run dev
```

```
Research agent. Ask me something. Type 'bye' to leave.
You: what changed in LangGraph v1?

  responder: drafted an answer, wants 3 search(es)
  research: read 6 source(s)
  revisor: revised — still wants 3 search(es)
  research: read 6 source(s)
  revisor: revised — every claim is sourced
  finalize: done

AI: LangGraph v1, released in October 2025, is a stability-focused update...

References:
  [1] https://docs.langchain.com/oss/javascript/releases/langgraph-v1
  [2] https://docs.langchain.com/oss/python/migrate/langgraph-v1
  ...

[grounded after 2 revision(s), 9 source(s) read]
```

The per-node progress comes from `app.stream` rather than `app.invoke` — a
two-round question takes about a minute, and without it there is no way to tell
a slow search from a hung process.

Conversations are remembered within a run, so follow-ups work:

```
You: expand on what you said about middleware

AI: Middleware in LangGraph v1 is a mechanism that allows developers to
    intercept and customize execution at multiple lifecycle points. It supports
    hooks such as `before_model`, `modify_model_request`...
```

## Cost, and the knobs that control it

A turn is **1 responder call + 1 revisor call per round**. Each research round
is up to 3 Tavily searches plus 1 extract call. A question grounded after two
rounds costs 3 model calls and 8 Tavily calls.

Every tuning constant is named and exported — no bare numbers in a node or a
prompt. In the order worth reaching for:

| constant | where | what it does |
|---|---|---|
| `MAX_REVISIONS` | [predicates.ts](src/agent/predicates.ts) | rounds before the backstop fires |
| `MAX_QUERIES_PER_ROUND` | [schemas.ts](src/agent/schemas.ts) | searches per round — enforced by the schema, not asked for in the prompt |
| `PAGES_TO_READ` | [extract.ts](src/agent/research/tools/extract.ts) | pages read in full per round. Most of the latency lives here |
| `FULL_TEXT_LIMIT` | [extract.ts](src/agent/research/tools/extract.ts) | characters kept per full-text read |
| `RESULTS_PER_QUERY` | [tavily.ts](src/agent/research/tools/tavily.ts) | raise this first if answers feel under-sourced |
| `MAX_EVIDENCE` | [state.ts](src/agent/state.ts) | ceiling on accumulated sources — what actually drives the cost of a late round |
| `MODEL` | [llm.ts](src/agent/llm.ts) | one line to trade cost against quality |

## Project structure

```
index.ts                     CLI; imports config first so env fails fast
src/
  config.ts                  validated environment — the app's full env inventory
  agent/
    graph.ts                 node + edge wiring, nothing else
    predicates.ts            branch conditions for conditional edges
    predicates.test.ts
    state.ts                 channels, their reducers, and the routing enums
    schemas.ts               the Reflexion output contract, shared by both nodes
    citations.ts             checks the answer's [n] markers against the evidence
    citations.test.ts
    llm.ts                   the OpenAI chat model
    rubric.ts                what a good answer looks like — shared by both prompts
    finalize.ts              writes the finished answer to the transcript
    responder/               first unsourced draft + self-critique + queries
    research/                runs the queries, reads the top pages, appends findings
      tools/tavily.ts        search
      tools/extract.ts       full-text reads
    revisor/                 rewrites against evidence, cites, re-critiques, votes
```

A specialist is added as its own folder — `src/agent/<name>/index.ts` for the
node, `src/agent/<name>/tools/` for its tools, exposed through that folder's
`index.ts`. `graph.ts` then imports one name per specialist and stays unaware of
how that folder is laid out inside. `CLAUDE.md` has the full set of conventions.

## Design notes

Things that are the way they are for a reason, and would be easy to undo by
accident.

**Working state lives in channels, not in `messages`.** The draft, the
critique, the queries and the evidence each get a typed channel.
`messages` appends, so putting revisions there means every draft is re-sent on
every later call, and "the last message" stops meaning the answer as soon as
another node runs. Only [finalize.ts](src/agent/finalize.ts) writes to the
transcript, once, at the end.

**`evidence` accumulates; everything else replaces.** A third-round answer
still rests on sources the first round found, so replacing that channel would
pull the ground out from under claims already made. It deduplicates by URL —
the revisor's follow-up queries are deliberately close to the originals, so
rounds re-find the same pages.

**An accumulating channel needs an explicit reset signal.** Clearing it by
passing `evidence: []` is a no-op, because merging an empty array changes
nothing. The reducer therefore reads an explicit `[]` as "new question" — which
in turn means an accidental empty write is destructive, so `research` returns an
empty patch rather than `{ evidence: [] }` when a round finds nothing.

**Citations are a field, not a "References:" block in the answer text.** A
prompt can ask for a format; a schema guarantees one. Keeping the URLs as
`string[]` is what lets [citations.ts](src/agent/citations.ts) check them and
the CLI render them however it likes.

**Citations are verified against the evidence.** The revisor is asked to copy
URLs out of the sources and mostly does — but an invented URL produces an answer
that *looks* sourced, and nothing else in the loop would catch it, because the
verdict is the same model's opinion of its own work. Unknown URLs are dropped
and dangling `[n]` markers are reported.

**Tavily swallows its own errors.** `TavilySearch` returns `{ error }` rather
than throwing, so a 401, a rate limit and a genuinely empty search all arrive
looking like an ordinary response. Reading `.results || []` off one turns a
wrong API key into a silent "I found no sources"; both clients check for that
shape explicitly and warn.

**Search snippets are not enough.** A few hundred ranked characters tell you a
page is relevant, rarely what it says. The strongest few pages per round are
read in full, which is where the specifics in a good answer come from — and
where most of the latency goes.

**The CLI iterates the readline interface instead of calling `question()` in a
loop.** `question()` only captures the line typed after it is called, so input
arriving while the graph is running is emitted to nobody and lost.

## Scripts

| command | what it does |
|---|---|
| `bun run dev` | start the CLI |
| `bun test` | run the tests (15, no API key needed) |
| `bun run typecheck` | `tsc --noEmit` |

## Status

Working: environment validation, the full Reflexion loop with an early exit and
a cap, parallel Tavily search with per-query failure tolerance, full-text reads
of the strongest pages, accumulating deduplicated evidence, citation
verification, streamed per-node progress, conversation memory within a run, and
tests over both pure modules.

Not built:

- **Persistence.** `MemorySaver` keeps conversations in process memory, so they
  are lost on restart. Deliberate — this project has no database.
- **Triage.** Every question goes through the full loop, including ones that
  need no search at all.
- **Claim-level checking.** Citations are verified to *exist*; nothing checks
  that the cited page actually supports the sentence it is attached to.
- **Transcript growth.** Finished answers accumulate in `messages` for the life
  of a thread, so a long conversation slowly grows its own prompt.
