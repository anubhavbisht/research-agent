/**
 * The research specialist's public tool surface.
 *
 * The reference project re-exports a `ToolNode` here; this loop has no tool
 * calls to route — the queries arrive as a typed field of the previous node's
 * structured output, so the tools are plain functions the node calls directly.
 * Same boundary, one less indirection.
 */
export { searchAll } from "./tavily";
export { readInFull } from "./extract";
