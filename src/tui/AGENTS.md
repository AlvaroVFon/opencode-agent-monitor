# AGENTS.md — `src/tui/`

TUI plugin for OpenCode V2. Reads per-session `.jsonl` files (written by the server plugin in `../server/`), aggregates events in memory, and renders a live sidebar panel plus a fullscreen session panel (`Ctrl+A`).

## Entry point

- `agent-monitor-tui.tsx` default-exports `Plugin.define({ id: "agent-monitor.tui", setup(context) })` from `@opencode/plugin/tui`.
- `setup()` registers the sidebar slot, the `session.panel` slot, and the keymap layer, then returns a cleanup function.
- Exported constants are asserted by the static test in `../test/tui/sidebar-order.test.ts`: `SIDEBAR_SLOT`, `PANEL_SLOT`, `PANEL_NAME`, `TOGGLE_COMMAND`, `PLUGIN_ID`.
- Trace dir resolution order (do not change without updating tests):
  1. `options.traceDir` from the plugin's options object
  2. `process.env.AGENT_MONITOR_DIR`
  3. `join(homedir(), ".config", "opencode", ".tracing")` (default)

## Architecture

```
{sessionID}.jsonl → SessionWatcher → AggregatorStore.ingest(event)
                                            → Solid signal
                                            → Components
                                            → Sidebar slot / session.panel
```

- **TuiMonitor** (`monitor.ts`) — owns the watcher lifecycle, the aggregator store, and cursor persistence. `switchSession()` stops the previous watcher, resumes from the stored cursor, and batch-loads the initial backfill with `{ silent: true }` + `flush()`. `snapshot()` is reactive; `snapshotFor(sessionID)` is session-scoped (includes delegated children).
- **SessionWatcher** (`session-watcher.ts`) — per-session incremental file reader. `fs.watch` + 250 ms polling fallback. Tracks byte cursor, detects truncation/rotation, skips malformed JSON silently.
- **AggregatorStore** (`aggregator-store.ts`) — in-memory state machine. Maintains `byAgent`, `bySession`, `byModel`, `byAgentModel`, `byTool`, `bySkill`. Calls `onSnapshot` on every `ingest()`.
- **CursorPersistence** (`cursor-store.ts`) — debounced (1 s) writes, flushed on session switch and teardown. `TuiStorageCursors` wraps `context.storage.store("agent-monitor", { initial: { cursors: {} } })`; reads use `untrack` so cursor writes do not retrigger effects.
- **ThemeAdapter** (`theme.adapter.ts`) — maps V2 `ResolvedTheme` (`text.base`, `border.base`, `hue.accent[500]`, `text.feedback.*`, `categorical[i][500]`) to the `PanelTheme` interface consumed by components. Formatters return palette **indexes**, not theme keys.

## Host APIs (V2)

- Sidebar: `context.ui.slot({ append: "sidebar.content", render: ({ sessionID }) => ... })`.
- Fullscreen: `context.ui.panel.open(PANEL_NAME, { presentation: "fullscreen" })`; the `session.panel` slot renders when `panel.name === PANEL_NAME`. `panel.close()` closes it.
- Keymap: `context.keymap.layer(() => ({ mode: "global", commands: [{ id, title, bind, run }] }))`. Component-scoped layers are disposed with the component; `Escape` is registered inside `FullscreenStatsPanel`.
- Toast: `context.ui.toast.show({ title, message, variant })`.
- Storage: `context.storage.store(key, { initial })` returns `[Store, async update]`.
- Cleanup: return a function from `setup`; call the slot unregister functions and `monitor.dispose()`.

## `@opentui/solid` JSX runtime

Components use the `@opentui/solid` JSX runtime (`0.6.x`):

- `<box>`, `<text>`, `<span>`, `<scrollbox>`
- Props: `flexDirection`, `padding`, `style={{ fg, bold, dim }}`
- `useKeyboard` still exists, but prefer `context.keymap.layer` for panel-scoped input.

This is **not** DOM JSX and not standard Solid — it is the OpenTUI renderer. Do not assume web `style` or `class` semantics.

## ADR-003: Components are implementation-only

**No unit tests for Solid components.** Tests cover pure formatters, the session watcher, the aggregator store, `TuiMonitor`, the cursor store, the theme adapter, and a static-analysis test for the slot/keymap wiring. Components are validated manually in the TUI host.

When adding a feature:

1. Extract logic into a pure function in `formatters/` or a class with injected dependencies (e.g. `CursorPersistence`).
2. Add unit tests with fixture factories.
3. Keep the component a thin wiring layer.

## Formatter conventions (`formatters/`)

All formatters are **pure functions** that take typed inputs and return either a `string` or a small object. No I/O, no state, no side effects.

- Use `n.toLocaleString("en-US")` for human-readable numbers.
- Format costs as `$X.toFixed(4)`.
- `formatDuration(ms)` — caps at hours, no days/years. Scale: `<1s` → `Xms`, `<60s` → `X.Xs`, `<60m` → `XmXs`, `>=1h` → `XhXm`.
- `formatAgentRow(agent, aggregate)`, `formatFullscreenTable(snapshot)`.
- `agentNameFormatter.colorIndex(name)` — deterministic DJB2 hash into `[0, AGENT_PALETTE_SIZE)`.
- Test pattern: pure function unit tests in `../test/tui/format-*.test.ts`.

## AggregatorStore details

- `ingest(event)` dispatches on `event.type` and updates relevant maps via private `addLlm` / `addLlmError` / `addTool` helpers.
- `llm_error` now counts errors, tokens, and cost (V2 sends usage on failed steps and failed compactions).
- `lastActiveAgent` is **out-of-order safe** (ADR-006): updated only on `llm_call`, and only if the incoming `timestamp >= current.timestamp`.
- `snapshot()` deep-clones everything; callers can mutate the result.
- `onSnapshot` fires synchronously inside `ingest()`.

## SessionWatcher details

- Constructor: `new SessionWatcher(traceDir, sessionID, { onLine, onError, pollIntervalMs? })`.
- `start(cursor?)` skips to a byte position; idempotent. `stop()` clears the watcher and poll timer.
- Malformed JSON lines are silently swallowed — do not add `console.warn`.

## Test patterns

Tests live in `../test/tui/`. Same `node:test` + `node:assert/strict` setup as the server side.

- `monitor.test.ts` writes real JSONL files into `mkdtempSync` dirs and waits ~60 ms for the watcher.
- `cursor-store.test.ts` injects a fake `{ get, set }` cursor storage and a fake `{ store }` TUI storage.
- `theme.adapter.test.ts` uses a plain object cast to `any`; colors do not need to be real `RGBA` values.
- `sidebar-order.test.ts` reads `agent-monitor-tui.tsx` as text because importing it pulls `@opentui/solid` (top-level await) into the test runner.

## ESM import extensions

All local imports in `src/tui/` use **`.js` extensions** (e.g. `import { ... } from "../shared/metrics.types.js"`). This is required by the project's ESM resolution. Do not drop the extension.

## Lifecycle and cleanup

`setup()` returns an async cleanup that:

1. Calls the two slot unregister functions.
2. Stops the active `SessionWatcher`.
3. Flushes pending cursor writes.

The keymap layer is owned by the host and removed automatically when the plugin unloads.
