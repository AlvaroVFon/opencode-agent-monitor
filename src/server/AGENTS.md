# AGENTS.md — `src/server/`

Server-side OpenCode V2 plugin entry point. Subscribes to the server event stream and tool hooks, writes per-session `{sessionId}.jsonl` traces. The TUI side lives in `../tui/` and consumes the JSONL this code produces.

## Entry point

- `agent-monitor.ts` default-exports `AgentMonitor = Plugin.define({ id: "agent-monitor", async setup(ctx) })` (from `@opencode/plugin`).
- `setup()` does four things:
  1. Reads `ctx.options.traceDir` / `ctx.options.locationFilter`.
  2. Registers `ctx.tool.hook("execute.before"/"execute.after")` → `ToolHookHandler`.
  3. Starts a background loop over `ctx.event.subscribe({ signal })`, filtered by `LocationFilter`.
  4. Returns a cleanup function that aborts the subscription, removes the `beforeExit` listener, and closes all streams.

`LocationFilter` (`helpers/location.helper.ts`) prevents duplicate writes when OpenCode instantiates the plugin per location while sharing one stream: located events are only processed by the instance that owns `ctx.location.directory`. Modes: `auto` (default), `match`, `all`. Override with `options.locationFilter` or `AGENT_MONITOR_LOCATION_FILTER`.

Environment fallbacks: `AGENT_MONITOR_DIR` (trace dir) and `AGENT_MONITOR_DEBUG=1` (log every received event type to stderr).

## Event pipeline (trace writing)

```
ctx.event.subscribe() ─┐
                       ├→ EventHandler.handle(event)
                       │    → EventsRegistry.get(event.type)
                       │    → for each Handler: handler.handle(event)
ctx.tool.hook(...) ────┴→ ToolHookHandler.before/after
```

- `EventsRegistry.register(type, handler)` returns `this` (fluent). Multiple handlers can be registered for the same event type and all run (e.g. `session.created` → session + delegation).
- Each handler implements `Handler<T>` (`handler.interface.ts`): one method, `handle(event: T): void`.
- Handler event types are `Extract<OpenCodeEvent, { type: ... }>` in `types.ts`, so a V2 contract change breaks `tsc`.
- Handlers write via `TraceHelper.writeTrace(...)`. Every event carries `timestamp: event.created` (not `Date.now()`), so ordering is stable across backfill.

### Handler list (registration order in `wire/handler-wiring.ts`)

| V2 Event                    | Handler                   | Notes                                                |
| --------------------------- | ------------------------- | ---------------------------------------------------- |
| `session.created`           | `SessionCreatedHandler`   | writes `session_created` (agent, title, parentID)    |
| `session.created`           | `AgentDelegationHandler`  | writes `agent_delegation` when `parentID` is present |
| `session.execution.failed`  | `SessionErrorHandler`     | writes `session_error`                               |
| `session.agent.selected`    | `AgentSelectedHandler`    | updates the session agent map; no trace write        |
| `session.step.started`      | `StepStartedHandler`      | records agent/model/start; no trace write            |
| `session.step.ended`        | `LlmCallHandler`          | writes `llm_call` using the recorded step            |
| `session.step.failed`       | `LlmErrorHandler`         | writes `llm_error`                                   |
| `session.compaction.ended`  | `CompactionEndedHandler`  | writes auxiliary `llm_call` (`kind: "compaction"`)   |
| `session.compaction.failed` | `CompactionFailedHandler` | writes `llm_error` (`kind: "compaction"`)            |
| `session.skill.activated`   | `SkillCallHandler`        | writes `skill_call`                                  |
| tool hooks                  | `ToolHookHandler`         | writes `tool_call` on `execute.after`                |

### Why the step tracker exists

V2 splits a model invocation across events: only `session.step.started` knows
`agent` and `model`; only `session.step.ended`/`failed` carry usage and finish.
`StepTracker` correlates them by `assistantMessageID`. If the start was missed
(plugin loaded mid-session), handlers fall back to `AgentTracker` and `UNKNOWN`.

### Why tool calls come from hooks

The public event stream (`session.tool.*`, `session.message.content.updated`) does
not expose the tool name. `ctx.tool.hook("execute.after")` provides `tool`,
`sessionID`, `agent`, `callID`, and status. `execute.before` records the start
time; `ToolHookHandler` computes the duration. The started map is capped at
1 000 entries to avoid leaks when a hook never completes.

## TraceHelper (`helpers/trace.helpers.ts`)

- **Synchronous** `appendFileSync` is not used; `Session` owns a `WriteStream`. Writes are ordered per session.
- `TraceHelper` routes child-session events to the parent file using `parentID`.
- `ensureDir()` is called lazily (not cached per write) — handles the trace dir being deleted at runtime.
- Default `traceDir` is `~/.config/opencode/.tracing`. `options.traceDir` overrides it.
- `close()` ends every stream; called from setup cleanup and `beforeExit`.

## Testing

Tests live in `../test/server/`. Runner: `node:test` + `node:assert/strict`.

- Fixtures: `../test/server/fixtures/v2-events.ts` (`makeStepStarted`, `makeStepEnded`, `makeRoleTool`, …). Add new factories there rather than inline objects.
- Handler tests inject `{ writeTrace: mock.fn(), ensureDir: () => {} } as any` and assert on `writeTrace.mock.calls[0].arguments[0]`.
- `v2-pipeline.test.ts` is the end-to-end golden test: a realistic event sequence must produce the expected ordered trace with `schemaVersion: 2`. Update it whenever the mapping changes.
- `agent-monitor.test.ts` stubs the V2 context (`options`, `location`, `tool.hook`, `event.subscribe`). Keep the stub minimal.

## Adding a new handler

1. Add the event view to `types.ts` with `Extract<OpenCodeEvent, { type }>`.
2. Create `handlers/trace/<name>.handler.ts` implementing `Handler<EventView>`.
3. Write a test in `../test/server/handlers/<name>.handler.test.ts` with a fixture.
4. Register it in `wire/handler-wiring.ts` under the matching `EventType`.
5. If it introduces a new trace event, update `shared/trace-events.types.ts`, `shared/enums.ts`, and the aggregators (`tui/aggregator-store.ts`, `cli/helpers/event-aggregator.helper.ts`).

## Quirks worth remembering

- Trace events use `event.created`; tool hooks have no timestamp and use `Date.now()`.
- `session.usage.recorded` is **not** on the public stream. Auxiliary spend is captured from `session.compaction.*`; title generation is not available.
- `llm_error` now carries optional `cost`/tokens, and both aggregators count them.
- All file writes are streamed per session. Do not switch to a single global file.
