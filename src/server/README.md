# Server Plugin

Traces OpenCode events to per-session newline-delimited JSON files for monitoring, analysis, and the TUI monitor.

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

Each session produces a single JSONL file at `{traceDir}/{safeSessionId}.jsonl`. All events from that session (including session errors) go to the same file — no separate error file.

File naming uses `sanitizeSessionId()` to ensure filesystem-safe names: non-alphanumeric characters (except `.`, `-`, `_`) are replaced with `_`.

Each line has a `type` field identifying the event kind and a `timestamp` field in milliseconds. Every event includes `schemaVersion: 1`.

```json
{"type":"session_created","sessionID":"sess-abc","parentID":null,"timestamp":1718000000000,"schemaVersion":1}
{"type":"llm_call","sessionID":"sess-abc","agent":"planner","model":"openai/gpt-4o","finish":"stop","inputTokens":450,"outputTokens":120,"reasoningTokens":0,"cacheRead":0,"cost":0.003,"durationMs":3200,"timestamp":1718000003200,"schemaVersion":1}
{"type":"tool_call","sessionID":"sess-abc","tool":"bash","callID":"call-1","status":"completed","durationMs":1500,"timestamp":1718000005000,"schemaVersion":1}
{"type":"agent_delegation","sessionID":"sess-abc","childAgent":"test-writer","timestamp":1718000006000,"schemaVersion":1}
{"type":"session_error","sessionID":"sess-abc","errorType":"timeout","errorMessage":"Session timed out after 5 minutes","timestamp":1718000007000,"schemaVersion":1}
```

## Architecture

Events are written via `WriteStream` (async non-blocking) through a `Session` class that owns one stream per active session:

```
SDK event → handler → traceHelper.write → Session.write → {dir}/{sessionId}.jsonl
```

- Streams are created lazily on the first write for each session.
- Append mode (`{ flags: "a" }`) supports session resume: if the file already exists, new events are appended.
- On process exit, `beforeExit` flushes and closes all streams gracefully.

## Error Tracking

- All errors (LLM errors, tool errors, session errors) are written to the session's JSONL file alongside normal events — single source of truth.
- The CLI and TUI aggregate errors from all session files when building reports.
