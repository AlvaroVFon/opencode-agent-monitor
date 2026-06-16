# System Patterns

## Architecture

### Dual-plugin architecture

The package exports two independent plugins:

1. **Server plugin** (`src/server/agent-monitor.ts`) — `Plugin` type, hooks into OpenCode server events, writes to `trace.jsonl`
2. **TUI plugin** (`src/tui/agent-monitor-tui.tsx`) — `TuiPluginModule` type, reads from `trace.jsonl`, renders in sidebar

The directory layout reflects this: `src/server/` (server plugin), `src/tui/` (TUI plugin), and `src/shared/` (types consumed by both). The TUI does not import from `src/server/`; the server does not import from `src/tui/`. Cross-product contracts live in `src/shared/`.

They communicate via the shared `trace.jsonl` file, not in-memory. This allows them to run in separate processes (server vs TUI host).

### Data flow (TUI)

```
trace.jsonl → JsonlTailer → AggregatorStore.ingest() → Solid signal → Components → TUI slots
```

### Aggregation pattern

Two aggregation implementations exist:

1. `MetricsAggregator` (`src/server/metrics/`) — ingests OpenCode SDK events (message.updated, etc.), used by server plugin
2. `AggregatorStore` (`src/tui/`) — ingests trace.jsonl events (llm_call, tool_call, etc.), used by TUI plugin

Both produce compatible `MetricsSnapshot` / `Aggregate` shapes (defined in `src/shared/metrics.types.ts`) but consume different input formats.

## Key Patterns

- **Pure formatters**: formatting logic is isolated in pure functions (`format-agent-row.ts`, `format-fullscreen-table.ts`) for testability
- **Cursor-based incremental reading**: JsonlTailer tracks byte offset, persisted via `api.kv`
- **Solid signals for reactivity**: AggregatorStore callbacks update Solid signals, triggering component re-renders

## Constraints

- CommonJS package (`"type": "commonjs"`) — `.tsx` files transpiled by `tsx` at dev time, by host at runtime
- No new npm dependencies — Solid is a peer dep of `@opencode-ai/plugin`
- `tsconfig.json` uses `"jsx": "preserve"` for type-checking only; `tsx` handles runtime transpilation
