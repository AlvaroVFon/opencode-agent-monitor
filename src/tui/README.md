# TUI Plugin

Real-time sidebar monitor for OpenCode. Reads per-session `.jsonl` files (written by the server plugin), aggregates events in memory, and displays live cost breakdowns per agent and model.

## Features

- **Sidebar panel** — agents sorted by cost descending. Each row shows cost, per-model breakdown, context tokens (input/output), call count, cache hit rate, average cost per call, and error count. The currently active agent is marked with a dot.
- **Fullscreen dialog** — press `Ctrl+A` to toggle an expanded table with totals and per-model breakdown.
- **Per-session persistent cursor** — each session file cursor survives TUI restarts via `api.kv`, so you never miss events between sessions. Cursor key format: `agent_monitor_cursor_{safeSessionId}`.

## Installation

In `~/.config/opencode/tui.json`:

```json
{
  "$schema": "https://opencode.ai/tui.json",
  "plugin": ["@alvarovfon/opencode-agent-monitor"]
}
```

## Trace Directory Resolution

The TUI reads the active session's `.jsonl` file from the trace directory resolved in this order:

1. `options.traceDir` from the plugin options
2. `AGENT_MONITOR_DIR` environment variable
3. `~/.config/opencode/.tracing` (default)

## Architecture

```
{sessionID}.jsonl → SessionWatcher → AggregatorStore → Solid signal → Components → Sidebar
```

- **SessionWatcher** — per-session incremental file reader with `fs.watch` + polling fallback. Resolves file path via `sessionFS.sessionFilePath()`. Detects file truncation and rotation. Replaces the old `JsonlTailer`.
- **AggregatorStore** — in-memory state machine that maintains per-agent, per-model, per-session, and per-tool aggregates. Supports silent batch ingest + `flush()` for efficient initial loading.
- **AgentCostPanel** — Solid component rendering the sidebar content.
- **FullscreenStatsDialog** — Solid component showing the expanded table.

## Keybindings

| Key      | Action                         |
| -------- | ------------------------------ |
| `Ctrl+A` | Toggle fullscreen stats dialog |
