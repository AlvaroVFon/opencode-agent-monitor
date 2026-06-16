# Architecture Decision Records

## ADR-001: TUI plugin reads trace.jsonl instead of sharing in-memory state

- **Date:** 2026-06-16
- **Context:** The server plugin and TUI plugin may run in separate processes. Sharing in-memory state (MetricsAggregator) is not viable cross-process.
- **Decision:** The TUI plugin reads from `trace.jsonl` using an incremental JsonlTailer, maintaining its own aggregation state (AggregatorStore).
- **Consequences:** Slight data latency (poll interval), but clean process isolation. The AggregatorStore reimplements aggregation logic for trace.jsonl event format (different from SDK events).

## ADR-002: AggregatorStore does not reuse MetricsAggregator

- **Date:** 2026-06-16
- **Context:** `MetricsAggregator` expects OpenCode SDK events (`message.updated` with `AssistantMessage` shape). `trace.jsonl` has a different format (`llm_call` with flat fields like `inputTokens`, `outputTokens`).
- **Decision:** AggregatorStore implements its own incremental aggregation matching the `scripts/metrics.mts` pattern, producing compatible `Aggregate` shapes.
- **Consequences:** Some code duplication, but avoids an awkward translation layer. Both consume the shared types from `src/shared/metrics.types.ts` (`Aggregate`, `MetricsSnapshot`, `TokenUsage`).

## ADR-003: Solid components are implementation-only (no TDD)

- **Date:** 2026-06-16
- **Context:** Solid JSX components require a DOM/renderer context to test meaningfully. The project uses `node --test` without a DOM environment.
- **Decision:** Components (AgentCostPanel, FullscreenStatsDialog) and the plugin entry are implementation-only tasks. Pure formatters and data logic get full TDD coverage.
- **Consequences:** 16 test cases cover the testable surface (tailer, store, formatters). Components are validated manually in the TUI host.

## ADR-004: tsconfig jsx set to "preserve"

- **Date:** 2026-06-16
- **Context:** The package is CommonJS. `.tsx` files are transpiled by `tsx` (dev) or the TUI host (runtime). `tsc --noEmit` only needs to type-check.
- **Decision:** Use `"jsx": "preserve"` in tsconfig so `tsc` can parse `.tsx` files without transforming them.
- **Consequences:** `tsc --noEmit` works for linting. Runtime JSX handling is delegated to `tsx` and the TUI host.
