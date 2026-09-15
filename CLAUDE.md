
Default to using Bun instead of Node.js.

- Use `bun <file>` instead of `node <file>` or `ts-node <file>`
- Use `bun test` instead of `jest` or `vitest`
- Use `bun build <file.html|file.ts|file.css>` instead of `webpack` or `esbuild`
- Use `bun install` instead of `npm install` or `yarn install` or `pnpm install`
- Use `bun run <script>` instead of `npm run <script>` or `yarn run <script>` or `pnpm run <script>`
- Use `bunx <package> <command>` instead of `npx <package> <command>`
- Bun automatically loads .env, so don't use dotenv.

## APIs

- `Bun.serve()` supports WebSockets, HTTPS, and routes. Don't use `express`.
- `bun:sqlite` for SQLite. Don't use `better-sqlite3`.
- `Bun.redis` for Redis. Don't use `ioredis`.
- `Bun.sql` for Postgres. Don't use `pg` or `postgres.js`.
- `WebSocket` is built-in. Don't use `ws`.
- Prefer `Bun.file` over `node:fs`'s readFile/writeFile
- Bun.$`ls` instead of execa.

## Testing

Use `bun test` to run tests.

```ts#index.test.ts
import { test, expect } from "bun:test";

test("hello world", () => {
  expect(1).toBe(1);
});
```

## Frontend

Use HTML imports with `Bun.serve()`. Don't use `vite`. HTML imports fully support React, CSS, Tailwind.

Server:

```ts#index.ts
import index from "./index.html"

Bun.serve({
  routes: {
    "/": index,
    "/api/users/:id": {
      GET: (req) => {
        return new Response(JSON.stringify({ id: req.params.id }));
      },
    },
  },
  // optional websocket support
  websocket: {
    open: (ws) => {
      ws.send("Hello, world!");
    },
    message: (ws, message) => {
      ws.send(message);
    },
    close: (ws) => {
      // handle close
    }
  },
  development: {
    hmr: true,
    console: true,
  }
})
```

HTML files can import .tsx, .jsx or .js files directly and Bun's bundler will transpile & bundle automatically. `<link>` tags can point to stylesheets and Bun's CSS bundler will bundle.

```html#index.html
<html>
  <body>
    <h1>Hello, world!</h1>
    <script type="module" src="./frontend.tsx"></script>
  </body>
</html>
```

With the following `frontend.tsx`:

```tsx#frontend.tsx
import React from "react";
import { createRoot } from "react-dom/client";

// import .css files directly and it works
import './index.css';

const root = createRoot(document.body);

export default function Frontend() {
  return <h1>Hello, world!</h1>;
}

root.render(<Frontend />);
```

Then, run index.ts

```sh
bun --hot ./index.ts
```

For more information, read the Bun API docs in `node_modules/bun-types/docs/**.mdx`.

# Project conventions

This project follows the architecture of `../linkedin-writer`, tightened where
that project named its own gaps. Keep new code on those lines or better; do not
introduce a second style alongside it.

## Layout

- `index.ts` is the entrypoint and imports `./src/config` first, before anything
  else, so a missing key fails at startup instead of inside a provider call.
- `src/config.ts` is the single inventory of every environment variable the app
  reads, validated with zod. A new env var is added there and to `.env.example`
  in the same change — nothing reads `process.env` directly.
- `src/agent/graph.ts` holds node and edge wiring and nothing else. No prompts,
  no tools, no business logic.
- `src/agent/predicates.ts` holds every branch condition. A predicate reads
  state and returns the name of the next node; it never mutates state and never
  calls a model. Anything that does belongs in a node. It is pure so it can be
  tested without an API key — a new predicate ships with its tests.
- `src/agent/state.ts` holds the state schema, the zod enums that close the
  routing decisions, and any non-trivial reducer. Add a route or verdict there
  first — the enum types the state channel, constrains what the model may emit,
  and supplies the graph's branch names.
- One folder per specialist under `src/agent/`, each with its own `tools/`
  subfolder that exposes its tools through that folder's `index.ts`. `graph.ts`
  imports one name per specialist and stays unaware of that folder's internals.
  A specialist never imports another specialist's tools.
- Anything two specialists share — the model, the rubric, the output contract —
  is a module directly under `src/agent/`, never a copy in each prompt. Two
  copies of the same rule drift, and the loop then spends passes undoing itself.
- A node that is not a specialist (no prompt, no tools, no model call — e.g.
  `finalize.ts`) is a flat module under `src/agent/`, not a folder.
- A shared subsystem (RAG, a client, a store) gets its own folder under `src/`
  and exposes its public API through that folder's `index.ts`. Nothing outside
  it imports the folder's internal modules directly.

## Graph

- Route on a value a node wrote with `withStructuredOutput` over a zod enum,
  never by parsing raw JSON or string-matching a model's prose.
- In this loop the critique and the verdict come from the node that produced the
  answer, in one call — that is Reflexion rather than a writer/critic pair. Do
  not add a second model to judge the first; add what the first model needs to
  judge itself.
- Every model-to-model loop needs a cap, and the cap lives in the predicate next
  to the branch it guards (see `MAX_REVISIONS`). Give the loop an early exit too
  — a verdict channel the predicate reads — so the cap is the backstop and not
  the normal way out. Give it a third exit for the degenerate case (no queries
  left to run), or the loop burns its whole budget repeating one round.
- A conditional edge goes after the node that writes the channel it branches on,
  never before it, or the predicate reads a verdict about a previous answer.
- Anything written per question (`revisions`, `queries`, `citations`, `verdict`)
  is reset by the caller at the top of each turn. The checkpointer persists
  state for the whole thread, so a counter left alone ends every later turn
  before it starts.
- A channel that grows every round (`evidence`) needs a ceiling and a
  deduplication rule in its reducer, not in the node. It is the largest thing in
  the prompt and it is what makes a late round cost several times an early one.
- Long-lived artifacts the graph revises (an answer, a plan) belong in their own
  state channel, not in the message list. `messages` is the conversation the
  user had; only the terminal node writes to it.
- Node functions take `GraphState` and return a partial state object. They do
  not read or write anything outside that.

## Style

- Comments explain *why*, not what — the trade-off, the failure that motivated
  the line, the thing that breaks if it is removed. No narration of syntax.
- A tuning constant is named, exported, and commented with what goes wrong on
  either side of it. No bare numbers in a prompt or a node.
- Whatever stands in for an external service (mock data, a fixture) keeps the
  shape of the real thing, so swapping in a live call changes nothing upstream.
- Network I/O is lazy: importing a module must never open a connection.
- One failed external call is not a failed turn. Degrade and tell the loop what
  is missing rather than throwing away work that already succeeded.
- Run `bun run typecheck` and `bun test` before calling a change done.
- Keep `README.md` current — the structure tree, the scripts table, and the
  "How it works" / "Status" sections are part of the change, not an afterthought.
