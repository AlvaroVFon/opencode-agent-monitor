# Server Plugin

Traces OpenCode V2 events to per-session newline-delimited JSON files for monitoring, analysis, and the TUI monitor.

## Configuration

In `~/.config/opencode/opencode.json`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": [
    {
      "package": "@alvarovfon/opencode-agent-monitor",
      "options": { "traceDir": "~/.config/opencode/.tracing" }
    }
  ]
}
```

| Option           | Default                       | Description                                                              |
| ---------------- | ----------------------------- | ------------------------------------------------------------------------ |
| `traceDir`       | `~/.config/opencode/.tracing` | Directory where trace files are written.                                 |
| `locationFilter` | `"auto"`                      | `auto` (filter located events), `match` (also drop unlocated), or `all`. |

`locationFilter` guards against duplicate writes when OpenCode instantiates the
plugin per location while sharing one event stream. Events that carry a
`location.directory` are only processed by the instance that owns it.

Environment fallbacks (useful for local plugin development):

- `AGENT_MONITOR_DIR` — same as `traceDir`.
- `AGENT_MONITOR_LOCATION_FILTER` — same as `locationFilter`.
- `AGENT_MONITOR_DEBUG=1` — log every received event type to stderr.

## Traced Events

| Trace Event        | OpenCode V2 source                                                          |
| ------------------ | --------------------------------------------------------------------------- |
| `session_created`  | `session.created` (`parentID`, `agent`, `title`)                            |
| `agent_delegation` | `session.created` with a `parentID`                                         |
| `llm_call`         | `session.step.ended`, with agent/model captured from `session.step.started` |
| `llm_call`         | `session.compaction.ended` (`kind: "compaction"`)                           |
| `llm_error`        | `session.step.failed` and `session.compaction.failed`                       |
| `tool_call`        | `ctx.tool.hook("execute.before"/"execute.after")`                           |
| `skill_call`       | `session.skill.activated`                                                   |
| `session_error`    | `session.execution.failed`                                                  |

OpenCode's public event stream does not expose tool names on `session.tool.*`
or the `session.message.content.updated` event, so tool calls are recorded from
the tool hooks, which also supply the agent.

## Output Format

Each session produces a single JSONL file at `{traceDir}/{safeSessionId}.jsonl`. All events from that session (including session errors) go to the same file — no separate error file. Delegated child sessions are routed to their parent's file.

File naming uses `sanitizeSessionId()` to ensure filesystem-safe names: non-alphanumeric characters (except `.`, `-`, `_`) are replaced with `_`.

Each line has a `type` field identifying the event kind and a `timestamp` field in milliseconds. Every event includes `schemaVersion: 2`.

```json
{"type":"session_created","sessionID":"sess-abc","parentID":null,"agent":"build","timestamp":1718000000000,"schemaVersion":2}
{"type":"llm_call","sessionID":"sess-abc","agent":"build","model":"anthropic/claude-sonnet-4-5","finish":"stop","inputTokens":450,"outputTokens":120,"reasoningTokens":0,"cacheRead":0,"cacheWrite":0,"cost":0.003,"durationMs":3200,"messageID":"msg-1","kind":"step","timestamp":1718000003200,"schemaVersion":2}
{"type":"tool_call","sessionID":"sess-abc","tool":"bash","callID":"call-1","status":"completed","durationMs":1500,"timestamp":1718000005000,"schemaVersion":2}
{"type":"agent_delegation","sessionID":"sess-child","parentID":"sess-abc","childSessionID":"sess-child","childAgent":"reviewer","timestamp":1718000006000,"schemaVersion":2}
{"type":"session_error","sessionID":"sess-abc","errorType":"provider.invalid-request","errorMessage":"bad request","timestamp":1718000007000,"schemaVersion":2}
```

Schema v1 lines written by the `1.x` plugin remain readable by the CLI.

## Architecture

Events are written via `WriteStream` (async non-blocking) through a `Session` class that owns one stream per active session:

```
ctx.event.subscribe() ─┐
                       ├→ handler → traceHelper.writeTrace → Session.write → {dir}/{sessionId}.jsonl
ctx.tool.hook(...) ────┘
```

- Streams are created lazily on the first write for each session.
- Append mode (`{ flags: "a" }`) supports session resume: if the file already exists, new events are appended.
- The cleanup function returned by `setup()` aborts the event subscription and closes all streams. A `beforeExit` hook is kept as a safety net.

## Error Tracking

- All errors (LLM errors, tool errors, session errors) are written to the session's JSONL file alongside normal events — single source of truth.
- The CLI and TUI aggregate errors from all session files when building reports.
