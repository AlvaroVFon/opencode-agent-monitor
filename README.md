# @alvarovfon/opencode-agent-monitor

[![npm version](https://img.shields.io/npm/v/@alvarovfon/opencode-agent-monitor)](https://www.npmjs.com/package/@alvarovfon/opencode-agent-monitor)
[![License](https://img.shields.io/npm/l/@alvarovfon/opencode-agent-monitor)](LICENSE)

Real-time TUI monitor and JSONL tracing plugin for OpenCode. Track LLM calls, agent delegations, tool calls, and session events with live cost breakdowns per agent and model.

## Installation

Install the plugin via OpenCode (recommended):

```bash
opencode plugin @alvarovfon/opencode-agent-monitor
```

Or add it to your project:

```bash
npm install @alvarovfon/opencode-agent-monitor
```

For the TUI monitor, also add the TUI plugin to your `tui.json` (see [Live TUI Monitor](#live-tui-monitor)).

## Live TUI Monitor

![TUI Monitor](assets/tui-screenshot.png)

Real-time sidebar panel that shows per-agent cost, context tokens, call stats, and errors — updated live as OpenCode runs.

### Setup

Add to `tui.json` (`~/.config/opencode/tui.json` or project-local):

```json
{
  "$schema": "https://opencode.ai/tui.json",
  "plugin": ["@alvarovfon/opencode-agent-monitor/tui"]
}
```

### Features

- **Sidebar panel** — agents sorted by cost descending. Each row shows cost, per-model breakdown, context tokens (input/output), call count, cache hit rate, average cost per call, and error count. The currently active agent is marked with a dot.
- **Fullscreen dialog** — press `Ctrl+A` to toggle an expanded table with totals and per-model breakdown.
- **Persistent cursor** — the trace file cursor survives TUI restarts, so you never miss events between sessions.

The trace directory is read from the same `traceDir` option used in the server plugin config (default: `~/.config/opencode/.tracing`).

## Tracing Plugin

The server-side plugin traces OpenCode events to newline-delimited JSON files for monitoring, analysis, and the TUI monitor.

### Configuration

Add the plugin to `opencode.json` (or `opencode.jsonc`):

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["@alvarovfon/opencode-agent-monitor"]
}
```

To set a custom trace directory:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": [
    [
      "@alvarovfon/opencode-agent-monitor",
      { "traceDir": "~/.config/opencode/.tracing" }
    ]
  ]
}
```

| Option     | Default                       | Description                              |
| ---------- | ----------------------------- | ---------------------------------------- |
| `traceDir` | `~/.config/opencode/.tracing` | Directory where trace files are written. |

### Traced Events

| OpenCode Event         | Trace Event        | Captured Data                                                                                                   |
| ---------------------- | ------------------ | --------------------------------------------------------------------------------------------------------------- |
| `session.created`      | `session_created`  | `sessionID`, `parentID`                                                                                         |
| `message.updated`      | `llm_call`         | `agent`, `model`, `finish`, `inputTokens`, `outputTokens`, `reasoningTokens`, `cacheRead`, `cost`, `durationMs` |
| `message.updated`      | `llm_error`        | `agent`, `model`, `errorType`, `errorMessage`                                                                   |
| `message.part.updated` | `tool_call`        | `tool`, `callID`, `status`, `durationMs`, optional `error`                                                      |
| `message.part.updated` | `agent_delegation` | `sessionID`, `childAgent`                                                                                       |
| `message.part.updated` | `agent_delegation` | `sessionID`, `childAgent`, `description` (subtasks)                                                             |
| `session.error`        | `session_error`    | `sessionID`, `errorType`, `errorMessage`                                                                        |

### Output Format

Events are written as newline-delimited JSON to two files inside the trace directory:

- **`trace.jsonl`** — all traced events
- **`trace.errors.jsonl`** — LLM errors and session errors (duplicated for easier error monitoring)

Each line has a `type` field identifying the event kind and a `timestamp` field in milliseconds.

```json
{"type":"session_created","sessionID":"sess-abc","parentID":null,"timestamp":1718000000000}
{"type":"llm_call","sessionID":"sess-abc","agent":"planner","model":"openai/gpt-4o","finish":"stop","inputTokens":450,"outputTokens":120,"reasoningTokens":0,"cacheRead":0,"cost":0.003,"durationMs":3200,"timestamp":1718000003200}
{"type":"llm_error","sessionID":"sess-abc","agent":"planner","model":"openai/gpt-4o","errorType":"rate_limit","errorMessage":"Rate limit exceeded","timestamp":1718000004000}
{"type":"tool_call","sessionID":"sess-abc","tool":"bash","callID":"call-1","status":"completed","durationMs":1500,"timestamp":1718000005000}
{"type":"agent_delegation","sessionID":"sess-abc","childAgent":"test-writer","timestamp":1718000006000}
{"type":"session_error","sessionID":"sess-abc","errorType":"timeout","errorMessage":"Session timed out after 5 minutes","timestamp":1718000007000}
```

### Trace File Location

| Source               | Default trace directory                           |
| -------------------- | ------------------------------------------------- |
| Server plugin        | `~/.config/opencode/.tracing` (or `traceDir` opt) |
| TUI monitor          | Same as server plugin (reads `traceDir` config)   |
| Batch metrics script | Same as server plugin (overridable via `--dir`)   |

## Batch Metrics Script

Aggregate all traced events from the command line into a Markdown or JSON report:

```bash
pnpm metrics
```

This reads `trace.jsonl` and `trace.errors.jsonl` from the trace directory and outputs a formatted report.

### Options

| Flag                  | Description                                              |
| --------------------- | -------------------------------------------------------- |
| `--dir <path>`        | Trace directory (default: `~/.config/opencode/.tracing`) |
| `--json`              | Output as JSON (default: Markdown)                       |
| `--markdown` / `--md` | Output as Markdown (default)                             |
| `-h` / `--help`       | Show help                                                |

### Example output (Markdown)

```
# Agent Monitor Metrics

**Window:** 2026-06-16T10:00:00.000Z → 2026-06-16T12:30:00.000Z (2h 30m)

## Summary

| Metric          | Value       |
|-----------------|-------------|
| LLM Calls       | 142         |
| LLM Errors      | 3           |
| Tool Calls      | 589         |
| Tool Errors     | 1           |
| Sessions Created| 12          |
| Session Errors  | 1           |
| Input Tokens    | 1,234,567   |
| Output Tokens   | 89,012      |
| Total Cost      | $12.3456    |

## By Agent

| Agent        | Calls | Errors | Input Tokens | Output Tokens | Cost      | Avg Duration |
|--------------|-------|--------|--------------|---------------|-----------|--------------|
| implementer | 58    | 1      | 520,000      | 34,000        | $5.2000   | 4,200ms      |
| planner     | 42    | 1      | 380,000      | 28,000        | $3.8000   | 3,100ms      |
| test-writer | 32    | 0      | 280,000      | 22,000        | $2.8000   | 2,800ms      |
```

## Error Handling

If writing to `trace.jsonl` fails (e.g., disk full, permission denied), the error is logged to `trace.errors.jsonl`. If writing to `trace.errors.jsonl` also fails, the error is silently swallowed to avoid disrupting the OpenCode session.

## Limitations

- The TUI components (Solid JSX) are implementation-only and lack DOM-based tests — all logic is extracted into pure format functions with full test coverage.
- The standalone CLI (`bin/agent-monitor`) is not yet implemented. The `metrics` script covers offline extraction.

## License

MIT
