# Architecture Decision Records

## ADR-001: TUI plugin reads trace.jsonl instead of sharing in-memory state

- **Date:** 2026-06-16
- **Context:** The server plugin and TUI plugin may run in separate processes. Sharing in-memory state (MetricsAggregator) is not viable cross-process.
- **Decision:** The TUI plugin reads from `trace.jsonl` using an incremental JsonlTailer, maintaining its own aggregation state (AggregatorStore).
- **Consequences:** Slight data latency (poll interval), but clean process isolation. The AggregatorStore reimplements aggregation logic for trace.jsonl event format (different from SDK events).

## ADR-002: AggregatorStore does not reuse MetricsAggregator

- **Date:** 2026-06-16
- **Updated:** 2026-06-18
- **Context:** `MetricsAggregator` expects OpenCode SDK events (`message.updated` with `AssistantMessage` shape). `trace.jsonl` has a different format (`llm_call` with flat fields like `inputTokens`, `outputTokens`).
- **Decision:** AggregatorStore implements its own incremental aggregation matching the `scripts/metrics.mts` pattern, producing compatible `Aggregate` shapes.
- **Update:** While the aggregation _classes_ remain separate (`MetricsAggregator`, `AggregatorStore`, `EventAggregatorHelper`), the low-level aggregate manipulation functions (`emptyAggregate`, `addToAggregate`, `cloneAggregate`, `mapToRecord`, etc.) are now unified in `src/shared/aggregate.helpers.ts`. The shared `AggregateHelper` class replaces both `MetricsAggregatorHelper` (server) and `AggregateHelper` (TUI). Pure function duplication is eliminated; aggregation logic is not duplicated.
- **Consequences:** Less code duplication while preserving the architectural separation of the two aggregation pipelines.

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

## ADR-005: Panel UI work is split into "testable formatters" + "implementation-only wiring"

- **Date:** 2026-06-16
- **Context:** The roadmap digression added five TUI improvements (sidebar order, collapsible title, totals row, agent name colors, working agent dot). ADR-003 says components have no DOM-based tests, but the helpers driving them are pure functions and ARE testable.
- **Decision:** For each TUI feature, extract the formatting/state logic into a pure function in `src/tui/formatters/` (e.g. `formatPanelHeader`, `formatTotalsRow`, `capitalizeName`, `getAgentColor`). The component (`agent-cost-panel.tsx`) becomes a thin wiring layer that calls those helpers. State that lives in the component itself (e.g. `collapsed` signal) is tested via a pure helper (`toggleCollapsed`). State that lives in the data layer (`lastActiveAgent` on `AggregatorStore`) is tested at the store level.
- **Consequences:** Every spec produces unit-testable code. The panel never has more than ~30 lines of conditional logic per change. Components remain hard to test directly, but their contracts are pinned by formatter tests.

## ADR-006: "Active agent" is derived from the most recent llm_call, not from session events

- **Date:** 2026-06-16
- **Context:** The working-dot indicator must show which agent is currently driving an LLM. Tool calls and session events are passive side-effects of an LLM-driven agent.
- **Decision:** `AggregatorStore.lastActiveAgent` is updated ONLY on `llm_call` events. Other event types (tool_call, session_created, session_error, agent_delegation) do not change it. The field is out-of-order safe: an `llm_call` whose `timestamp` is older than the current `lastActiveAgent.timestamp` is ignored.
- **Consequences:** The dot correctly tracks the agent that actually initiated the LLM request, even when tool events arrive interleaved. Replays with out-of-order timestamps behave deterministically.
