# Server Plugin

Traces OpenCode events to newline-delimited JSON files for monitoring, analysis, and the TUI monitor.

## Configuration

In `~/.config/opencode/opencode.json`:

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

## Traced Events

| OpenCode Event         | Trace Event        | Captured Data                                                                                                   |
| ---------------------- | ------------------ | --------------------------------------------------------------------------------------------------------------- |
| `session.created`      | `session_created`  | `sessionID`, `parentID`                                                                                         |
| `message.updated`      | `llm_call`         | `agent`, `model`, `finish`, `inputTokens`, `outputTokens`, `reasoningTokens`, `cacheRead`, `cost`, `durationMs` |
| `message.updated`      | `llm_error`        | `agent`, `model`, `errorType`, `errorMessage`                                                                   |
| `message.part.updated` | `tool_call`        | `tool`, `callID`, `status`, `durationMs`, optional `error`                                                      |
| `message.part.updated` | `agent_delegation` | `sessionID`, `childAgent`                                                                                       |
| `message.part.updated` | `agent_delegation` | `sessionID`, `childAgent`, `description` (subtasks)                                                             |
| `session.error`        | `session_error`    | `sessionID`, `errorType`, `errorMessage`                                                                        |

## Output Format

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

## Error Tracking

- `errors[]` — detailed error entries with `sessionID`, `type`, `message`, `timestamp`
- `totals.sessionErrors` — count of `session.error` events
- Errors captured from: `llm_error`, `tool_call` errors, `session_error`
- Capped at 1000 entries (oldest evicted first)
