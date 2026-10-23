# TUI Plugin

Real-time sidebar monitor for OpenCode V2. Reads per-session `.jsonl` files (written by the server plugin), aggregates events in memory, and displays live cost breakdowns per agent and model.

## Features

- **Sidebar panel** — agents sorted by cost descending. Each row shows cost, per-model breakdown, context tokens (input/output), call count, cache hit rate, average cost per call, and error count. The currently active agent is marked with a dot.
- **Fullscreen panel** — press `Ctrl+A` to toggle an expanded table with totals and per-model breakdown. Escape closes it.
- **Per-session persistent cursor** — each session file cursor survives TUI restarts via `context.storage.store("agent-monitor")`, so you never miss events between sessions.

## Installation

The TUI plugin ships in the same package as the server plugin through the
`./tui` export, so it loads automatically when the package is listed in
`~/.config/opencode/opencode.json`.

To keep it active against a remote server, or to use it without the server
plugin, add it to `~/.config/opencode/cli.json`:

```json
{
  "plugins": ["@alvarovfon/opencode-agent-monitor"]
}
```

## Trace Directory Resolution

The TUI reads the active session's `.jsonl` file from the trace directory resolved in this order:

1. `options.traceDir` from the plugin options
2. `AGENT_MONITOR_DIR` environment variable
3. `~/.config/opencode/.tracing` (default)

## Architecture

```
{sessionID}.jsonl → SessionWatcher → AggregatorStore → Solid signal → Components → Sidebar / session.panel
```

- **TuiMonitor** (`monitor.ts`) — owns the watcher lifecycle, the aggregator store, and cursor persistence. Created once in `setup()`.
- **SessionWatcher** — per-session incremental file reader with `fs.watch` + polling fallback. Resolves file path via `sessionFS.sessionFilePath()`. Detects file truncation and rotation.
- **AggregatorStore** — in-memory state machine that maintains per-agent, per-model, per-session, and per-tool aggregates. Supports silent batch ingest + `flush()` for efficient initial loading.
- **CursorPersistence** (`cursor-store.ts`) — debounced writes with a flush on session switch and plugin teardown.
- **AgentCostPanel** — Solid component rendering the sidebar content.
- **FullscreenStatsPanel** — Solid component rendered by the native `session.panel` slot.
- **ThemeAdapter** (`theme.adapter.ts`) — maps OpenCode V2's semantic theme to the small palette the components use.

## Host APIs (OpenCode V2)

| Concern      | API                                                                                   |
| ------------ | ------------------------------------------------------------------------------------- |
| Sidebar      | `context.ui.slot({ append: "sidebar.content", render })`                              |
| Fullscreen   | `context.ui.slot({ append: "session.panel", render })` + `context.ui.panel.open(...)` |
| Keymap       | `context.keymap.layer(() => ({ commands: [...] }))`                                   |
| Cursor state | `context.storage.store("agent-monitor", { initial })`                                 |
| Theme        | `context.theme` (`ResolvedTheme`)                                                     |
| Toast        | `context.ui.toast.show({ message, variant })`                                         |
| Cleanup      | return a function from `setup()`                                                      |

## Keybindings

| Key      | Action                        |
| -------- | ----------------------------- |
| `Ctrl+A` | Toggle fullscreen stats panel |
| `Escape` | Close the fullscreen panel    |
