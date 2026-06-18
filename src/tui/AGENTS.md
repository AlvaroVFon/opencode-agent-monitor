# AGENTS.md — `src/tui/`

TUI plugin for OpenCode. Reads `trace.jsonl` (written by the server plugin in `../server/`), aggregates events in memory, and renders a live sidebar panel + a fullscreen dialog (`Ctrl+A`).

## Entry point

- `agent-monitor-tui.tsx` exports `default { id, tui }` — the `TuiPlugin` shape.
- `SIDEBAR_ORDER` (currently `1`) is the slot ordering constant — **tested by static source analysis** in `../test/tui/sidebar-order.test.ts`. Do not hardcode a number in `api.slots.register`; reference the constant.
- Trace dir resolution order (do not change without updating tests):
  1. `options.traceDir` from the plugin's options object
  2. `process.env.AGENT_MONITOR_DIR`
  3. `join(homedir(), ".config", "opencode", ".tracing")` (default)

## Architecture

```
trace.jsonl → JsonlTailer → AggregatorStore.ingest(event) → emitSnapshot()
                                                       → Solid signal
                                                       → Components
                                                       → TUI slots
```

- `JsonlTailer` (`jsonl-tailer.ts`) — incremental file reader. `fs.watch` + 250ms polling fallback. Tracks byte cursor. Detects truncation/rotation. Silently skips malformed JSON lines.
- `AggregatorStore` (`aggregator-store.ts`) — in-memory state machine. Maintains `byAgent`, `bySession`, `byModel`, `byAgentModel`. Calls `onSnapshot` callback on every `ingest()`. `snapshot()` returns a deep-cloned `MetricsSnapshot`.
- Cursor is persisted via `api.kv.get("agent_monitor_cursor")` / `api.kv.set(...)`. Persistence is debounced (1s timer) and also flushed in `onDispose`.

## `@opentui/solid` JSX runtime

All components use the `@opentui/solid` JSX runtime. Available elements:

- `<box>`, `<text>`, `<span>`, `<scrollbox>`
- Props: `flexDirection`, `padding`, `style={{ fg: ..., bold: true, dim: true }}`
- Hooks: `useKeyboard` from `@opentui/solid` for key handling

This is **not** DOM JSX and not standard Solid — it is the OpenTUI renderer. Do not assume web `style` or `class` semantics.

## ADR-003: Components are implementation-only

**No unit tests for Solid components.** The TUI tests cover pure formatters, the JSONL tailer, the aggregator store, and a static-analysis test for `SIDEBAR_ORDER`. Components (`agent-cost-panel.tsx`, `fullscreen-stats-dialog.tsx`) are validated manually in the TUI host.

When adding a feature to a component:

1. **Extract logic into a pure function in `formatters/`** (e.g. `formatTotalsRow`, `formatPanelHeader`, `toggleCollapsed`, `capitalizeName`, `getAgentColor`). These get TDD coverage.
2. The component itself is a thin wiring layer that calls those helpers.
3. If a piece of state lives in the component (e.g. a `collapsed` signal), back it with a pure helper so its transitions are testable.
4. If a piece of state lives in the data layer (`lastActiveAgent` on `AggregatorStore`), test it at the store level.

This is ADR-005. Don't try to test components with `jsdom` or similar — the project explicitly avoids a DOM environment.

## Formatter conventions (`formatters/`)

All formatters are **pure functions** that take typed inputs and return either a `string` or a small object. No I/O, no state, no side effects.

- Use `n.toLocaleString("en-US")` for human-readable numbers.
- Format costs as `$X.toFixed(4)`.
- `formatDuration(ms)` — caps at hours, no days/years. Scale: `<1s` → `Xms`, `<60s` → `X.Xs`, `<60m` → `XmXs`, `>=1h` → `XhXm`.
- `formatAgentRow(agent, aggregate)` — one-line summary; `formatAgentRows(byAgent)` returns the full list sorted by cost descending.
- `getAgentColor(name)` — deterministic DJB2 hash into a 5-color palette (`accent`, `secondary`, `info`, `success`, `warning`).
- Test pattern: pure function unit tests in `../test/tui/format-*.test.ts`. Fixture factories with `overrides` parameter.

## AggregatorStore details

- `ingest(event)` dispatches on `event.type` and updates relevant maps via private `addLlm` / `addTool` helpers.
- Five internal `Map`s: `byAgent`, `bySession`, `byModel`, `byAgentModel` (nested), plus a `lastActiveAgent` field.
- `lastActiveAgent` is **out-of-order safe** (ADR-006): updated only on `llm_call` events, and only if the incoming `timestamp >= current.lastActiveAgent.timestamp`. Tool calls, session events, and agent delegations do not change it.
- `snapshot()` deep-clones everything via `Object.fromEntries` and aggregate cloning. Callers can mutate the result safely.
- `reset()` clears all state including `lastActiveAgent`.
- `onSnapshot` callback fires synchronously inside `ingest()`. The TUI entry wraps this in a Solid signal setter.

## JsonlTailer details

- Constructor: `new JsonlTailer(filePath, { onLine, onError, pollIntervalMs? })`.
- `start(cursor?)` — if cursor is provided, skips to that byte position. Idempotent.
- `stop()` — clears watcher and poll timer. Sets `_started = false` so `start()` can be called again.
- Truncation/rotation detection: if `stats.size < _cursor` or the first line changes, treats it as a reset.
- Malformed JSON lines are silently swallowed — do not add `console.warn` for them.
- `onError` callbacks are wrapped in try/catch — a throw inside the callback does not crash the tailer.

## Test patterns

Tests live in `../test/tui/`. Same `node:test` + `node:assert/strict` setup as the server side.

### Pure formatter tests

- No mocking. No fixtures beyond simple factory functions like `makeAggregate` and `makeSnapshot`.
- Assert on exact output shape, including the object key set (e.g. `assert.deepEqual(Object.keys(result).sort(), ['avgCostPerCall', 'calls', 'errors'])`).
- Test edge cases: zero values, thousands separators, single-agent vs N agents, empty inputs.

### Aggregator store tests (`aggregator-store.test.ts`)

- Fixture factories: `makeLlmCallEvent`, `makeToolCallEvent`, `makeSessionCreatedEvent`, `makeSessionErrorEvent`, `makeAgentDelegationEvent`, all with `overrides`.
- `lastActiveAgent` has its own `describe` block with 12 cases — out-of-order timestamp safety, non-regression on other event types, reset behavior, snapshot clone immutability.
- Cross-validation test against `scripts/metrics.mts` was removed together with the script (superseded by CLI).

### Static source analysis test (`sidebar-order.test.ts`)

- Cannot import the TUI module directly because it transitively pulls in `@opentui/solid`, which uses top-level await and is incompatible with the test runner's transform.
- Workaround: read the `.tsx` file with `fs.readFileSync`, extract the `SIDEBAR_ORDER` constant with regex, and assert on it. Same approach used to assert the constant is referenced in `api.slots.register` (not a hardcoded literal).

## ESM import extensions

All local imports in `src/tui/` use **`.js` extensions** (e.g. `import { ... } from "../shared/metrics.types.js"`). This is required by the project's ESM resolution. Do not drop the extension.

## Lifecycle and cleanup

The TUI plugin registers three things and must clean up all three on `onDispose`:

- `api.slots.register({...})` — returns nothing to unregister; slot lifecycle is managed by the TUI host.
- `api.keymap.registerLayer({...})` — returns an `unregister` function; call it in `onDispose`.
- `tailer.stop()` — clear watcher and poll timer; flush cursor to `api.kv` if there's a pending debounce.

The TUI entry guards tailer setup in a try/catch so a failure to find the trace dir does not prevent the sidebar panel from rendering. Failures show a toast via `api.ui.toast`.

## Adding a new panel feature

1. Extract the formatting/state logic into a pure function in `formatters/`.
2. Add a unit test in `../test/tui/format-<name>.test.ts` with edge cases.
3. Wire the pure function into the component as a thin call.
4. If the feature needs a new signal/state, put it in the component only if it's UI-local; otherwise expose it from `AggregatorStore` and test at the store level.
