# @alvarovfon/opencode-agent-monitor

[![npm version](https://img.shields.io/npm/v/@alvarovfon/opencode-agent-monitor)](https://www.npmjs.com/package/@alvarovfon/opencode-agent-monitor)
[![License](https://img.shields.io/npm/l/@alvarovfon/opencode-agent-monitor)](LICENSE)

OpenCode plugin that traces LLM calls, agent delegations, subtask assignments, and session events to JSONL files for monitoring and analysis.

## Installation

```bash
opencode plugin @alvarovfon/opencode-agent-monitor
```

This installs the package and adds it to your `opencode.json` automatically.

## Configuration

The plugin is added to `opencode.json` or `opencode.jsonc` under the `plugin` key (singular):

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["@alvarovfon/opencode-agent-monitor"]
}
```

To pass options (e.g. custom `traceDir`), use the tuple format:

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

If not specified, `traceDir` defaults to `~/.config/opencode/.tracing`.

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
- **`trace.errors.jsonl`** — LLM errors and session errors (duplicated from `trace.jsonl` for easier error monitoring)

Each line is a JSON object with a `type` field identifying the event kind and a `timestamp` field in milliseconds.

Example `trace.jsonl` entry:

```json
{
  "type": "llm_call",
  "sessionID": "sess-abc",
  "agent": "planner",
  "model": "openai/gpt-4o",
  "finish": "stop",
  "inputTokens": 450,
  "outputTokens": 120,
  "reasoningTokens": 0,
  "cacheRead": 0,
  "cost": 0.003,
  "durationMs": 3200,
  "timestamp": 1718000000000
}
```

## Metrics

The plugin aggregates events in-memory and exposes them through an `agent_monitor_stats` tool that the LLM can invoke mid-conversation.

### agent_monitor_stats

The tool accepts the following parameters:

| Parameter   | Type                                     | Default  | Description                                 |
| ----------- | ---------------------------------------- | -------- | ------------------------------------------- |
| `since`     | `"1h"` \| `"24h"` \| `"7d"` \| `"all"`  | `"24h"`  | Time window (time-based filtering upcoming) |
| `groupBy`   | `"agent"` \| `"model"` \| `"tool"`      | —        | Breakdown dimension (optional)              |
| `sessionID` | `string`                                 | —        | Filter to a specific session (optional)     |
| `format`    | `"markdown"` \| `"json"`                | `"markdown"` | Output format                          |

#### Example (markdown, default)

The LLM can ask "show me the metrics" and receive a table:

```
## Agent Monitor Stats

| Metric | Value |
|--------|-------|
| Sessions Created | 3 |
| LLM Calls | 15 |
| LLM Errors | 1 |
| Tool Calls | 42 |
| Tool Errors | 2 |
| Tokens (Input) | 12,500 |
| Tokens (Output) | 34,000 |
| Tokens (Reasoning) | 500 |
| Tokens (Cache Read) | 2,000 |
| Cost | $0.0850 |
```

With `groupBy: "agent"` a breakdown section is appended:

```
### By Agent
| Agent | LLM Calls | LLM Errors | Tool Calls | Tool Errors | Cost |
|-------|-----------|------------|------------|-------------|------|
| coder | 8 | 0 | 25 | 1 | $0.0450 |
```

#### Example (JSON)

```json
{
  "totals": {
    "llmCalls": 15,
    "llmErrors": 1,
    "toolCalls": 42,
    "toolErrors": 2,
    "tokens": { "input": 12500, "output": 34000, "reasoning": 500, "cacheRead": 2000 },
    "cost": 0.085,
    "sessionsCreated": 3
  },
  "breakdown": {
    "coder": { "llmCalls": 8, "llmErrors": 0, "toolCalls": 25, "toolErrors": 1, "cost": 0.045 },
    "reviewer": { "llmCalls": 7, "llmErrors": 1, "toolCalls": 17, "toolErrors": 1, "cost": 0.040 }
  }
}
```

> **Note:** `since` filtering is accepted but not yet enforced (per-event timestamps will be tracked in a future release). All events are always included regardless of the `since` value.

## Error Handling

If writing to `trace.jsonl` fails (e.g., disk full, permission denied), the error is logged to `trace.errors.jsonl`. If writing to `trace.errors.jsonl` also fails, the error is silently swallowed to avoid disrupting the OpenCode session.

## Limitations

This release (v0.2.x) traces events, aggregates metrics in-memory, and exposes them via the `agent_monitor_stats` tool. The following are planned for future releases (see [`ROADMAP.md`](./ROADMAP.md)):

- A CLI (`agent-monitor stats | errors | tail | export`) to read the JSONL files from the terminal
- Per-event timestamp tracking for time-window filtering
- Percentiles (p50/p95 latency)
- Sampling, buffer flush, anomaly detection

## Releasing

Releases are fully automated via [release-please](https://github.com/googleapis/release-please) and [Conventional Commits](https://www.conventionalcommits.org/):

1. Open a PR to `main` with commits following the convention (`feat:`, `fix:`, `perf:`, `refactor:`, etc.)
2. `release-please` opens/updates a **Release PR** with a version bump and a regenerated `CHANGELOG.md`
3. Merging the Release PR:
   - Creates the GitHub Release (tag `vX.Y.Z`)
   - Triggers the `publish` workflow
   - Publishes to npm with provenance via [Trusted Publishers (OIDC)](https://docs.npmjs.com/generating-provenance-statements)

Commit messages are validated locally by `husky` + `commitlint` (run `npm install` to enable the hook). To run a release dry-run locally: `npx release-please release-pr --dry-run`.

## License

MIT
