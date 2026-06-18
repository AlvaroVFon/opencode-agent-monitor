# TUI Plugin

Real-time sidebar monitor for OpenCode. Reads `trace.jsonl` (written by the server plugin), aggregates events in memory, and displays live cost breakdowns per agent and model.

## Features

- **Sidebar panel** — agents sorted by cost descending. Each row shows cost, per-model breakdown, context tokens (input/output), call count, cache hit rate, average cost per call, and error count. The currently active agent is marked with a dot.
- **Fullscreen dialog** — press `Ctrl+A` to toggle an expanded table with totals and per-model breakdown.
- **Persistent cursor** — the trace file cursor survives TUI restarts via `api.kv`, so you never miss events between sessions.

## Installation

In `~/.config/opencode/tui.json`:

```json
{
  "$schema": "https://opencode.ai/tui.json",
  "plugin": ["@alvarovfon/opencode-agent-monitor"]
}
```

## Trace Directory Resolution

The TUI reads `trace.jsonl` from the first directory found in this order:

1. `options.traceDir` from the plugin options
2. `AGENT_MONITOR_DIR` environment variable
3. `~/.config/opencode/.tracing` (default)

## Architecture

```
trace.jsonl → JsonlTailer → AggregatorStore → Solid signal → Components → Sidebar
```

- **JsonlTailer** — incremental file reader with `fs.watch` + polling fallback. Detects file truncation and rotation.
- **AggregatorStore** — in-memory state machine that maintains per-agent, per-model, per-session, and per-tool aggregates.
- **AgentCostPanel** — Solid component rendering the sidebar content.
- **FullscreenStatsDialog** — Solid component showing the expanded table.

## Keybindings

| Key      | Action                         |
| -------- | ------------------------------ |
| `Ctrl+A` | Toggle fullscreen stats dialog |
