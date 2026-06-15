# @alvarovfon/opencode-agent-monitor

[![npm version](https://img.shields.io/npm/v/@alvarovfon/opencode-agent-monitor)](https://www.npmjs.com/package/@alvarovfon/opencode-agent-monitor)
[![License](https://img.shields.io/npm/l/@alvarovfon/opencode-agent-monitor)](LICENSE)

OpenCode plugin that traces LLM calls, agent delegations, subtask assignments, and session events to JSONL files for monitoring and analysis.

## Installation

```bash
npm install @alvarovfon/opencode-agent-monitor
```

## Configuration

Add the plugin to your `opencode.json` or `opencode.jsonc`:

```jsonc
{
  "plugins": [
    {
      "name": "agent-monitor",
      "path": "@alvarovfon/opencode-agent-monitor",
      "options": {
        "traceDir": "~/.config/opencode/.tracing",
      },
    },
  ],
}
```

The `traceDir` option is optional. It defaults to `~/.config/opencode/.tracing`.

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

## Error Handling

If writing to `trace.jsonl` fails (e.g., disk full, permission denied), the error is logged to `trace.errors.jsonl`. If writing to `trace.errors.jsonl` also fails, the error is silently swallowed to avoid disrupting the OpenCode session.

## Limitations

This release (v0.1.x) only writes raw events. It does **not** yet aggregate, query or display metrics. The following are planned for v0.2.0 (see [`ROADMAP.md`](./ROADMAP.md)):

- Aggregated metrics (totals, per-agent / per-model / per-tool breakdowns, p50/p95 latency, error rate)
- A tool that the LLM can invoke mid-conversation to display those metrics
- A CLI (`agent-monitor stats | errors | tail | export`) to read the JSONL files from the terminal

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
