# AGENTS.md — `src/server/`

Server-side OpenCode plugin entry point. Writes `trace.jsonl` and `trace.errors.jsonl`, runs the server-side `MetricsAggregator`. The TUI side lives in `../tui/` and consumes the JSONL file this code produces.

## Entry point

- `agent-monitor.ts` exports `AgentMonitor: Plugin` (from `@opencode-ai/plugin`).
- Plugin returns two hooks:
  - `"chat.params"` → mutates the shared `currentAgent` map.
  - `"event"` → calls `eventHandler.handle(event)` **and** `metricsAggregator.ingest(event)`. The two pipelines are parallel and independent.
- A module-level `const currentAgent = new Map<string, string>()` is shared with all handlers and the aggregator by reference.

## Event pipeline (trace writing)

```
EventHandler.handle(event)
  → EventsRegistry.get(event.type)
  → for each Handler: handler.handle(properties)
```

- `EventsRegistry.register(type, handler)` returns `this` (fluent). Multiple handlers can be registered for the same `EventType` and all run.
- Each handler implements `Handler` (defined in `handler.interface.ts`): one method, `handle(properties: unknown): void`.
- The `properties` argument is typed as `unknown` — every handler casts it at the call site.
- Handlers write trace events via `TraceHelper.writeTrace(event)` (sync) and `TraceHelper.writeTraceError(event)` (sync, used for failures).

### Handler list (in registration order in `agent-monitor.ts`)

| EventType              | Handler                    | Notes                                                                  |
| ---------------------- | -------------------------- | ---------------------------------------------------------------------- |
| `SESSION_CREATED`      | `SessionCreatedHandler`    | writes `session_created`                                               |
| `SESSION_ERROR`        | `SessionErrorHandler`      | writes both `session_error` and to errors file                         |
| `MESSAGE_UPDATED`      | `UserMessageHandler`       | mutates `currentAgent` map only; **no trace write**                    |
| `MESSAGE_UPDATED`      | `LlmErrorHandler`          | writes `llm_error` to both files                                       |
| `MESSAGE_UPDATED`      | `LlmCallHandler`           | writes `llm_call`                                                      |
| `MESSAGE_PART_UPDATED` | `AgentDelegationHandler`   | writes `agent_delegation` for `PartType.AGENT`                         |
| `MESSAGE_PART_UPDATED` | `SubtaskDelegationHandler` | writes `agent_delegation` (with `description`) for `PartType.SUBTASK`  |
| `MESSAGE_PART_UPDATED` | `ToolCallHandler`          | writes `tool_call` for `PartType.TOOL` with `COMPLETED`/`ERROR` status |

### Registration order is **load-bearing**

`UserMessageHandler` must be registered before `LlmErrorHandler` and `LlmCallHandler` for `MESSAGE_UPDATED`. Both LLM handlers read from the `currentAgent` map; if the user-message handler hasn't run yet for the same event, attribution falls back to `UNKNOWN`. Do not reorder.

## Handler conventions

- **Constructor takes dependencies** (`TraceHelper`, and `currentAgent: Map<string, string>` for LLM handlers). No DI container.
- **Early-return guard** at the top of `handle()` to filter irrelevant events. Example: `if (part.type !== PartType.TOOL) return;`.
- **Untyped properties** — every handler begins with a cast like `const props = properties as { ... }`. Do not try to type `Handler.handle` more strictly; runtime variance is part of the contract.
- **`UNKNOWN` constant** from `enums.ts` is the fallback when a field is missing.
- **LLM attribution**: derive `agent` from `currentAgent.get(msg.sessionID) ?? UNKNOWN`. Derive `model` as `${msg.providerID}/${msg.modelID}`.
- **LLM call** requires `role === ASSISTANT && msg.finish && msg.tokens && msg.time?.completed`.
- **LLM error** requires `role === ASSISTANT && msg.error && !msg.tokens` (the `!msg.tokens` is the only thing that distinguishes error from success).
- **Tool call** is only tracked when status is `COMPLETED` or `ERROR`; `pending`/`running` are ignored. `durationMs = null` if `state.time.end` is missing.
- `extractErrorMessage(data)` (in `helpers/error.helpers.ts`) is the standard way to safely serialize an unknown-typed error.

## TraceHelper (`helpers/trace.helpers.ts`)

- **Synchronous** `appendFileSync` — deliberately blocking. Guarantees trace lines are never interleaved across handlers and the SDK's event loop tolerates blocking writes.
- `writeTrace` catches errors and re-routes them to `writeTraceError` with a `WRITE_TRACE_ERROR` event — last-resort channel.
- `writeTraceError` has a **deliberately empty** `catch` block. Errors writing the error log are silently swallowed; we cannot do anything about them and must not disrupt the OpenCode session.
- `ensureDir()` is called on every write (not cached) — handles the case where the trace dir is deleted at runtime.
- Default `traceDir` is `~/.config/opencode/.tracing`. The plugin's `options.traceDir` overrides it.

## Metrics pipeline (parallel to trace pipeline)

- `MetricsAggregator` in `metrics/metrics.aggregator.ts` ingests the **same SDK events** as the trace pipeline. It is **not** an output of the trace; it is a parallel consumer.
- Internal state: `totals`, `bySession`, `byAgent`, `byModel`, `byAgentModel`. `snapshot()` returns a defensive-cloned `MetricsSnapshot`.
- `MetricsAggregator` uses its **own** `MetricsHandlersRegistry` (single-handler-per-event) — separate from the `EventsRegistry` used by trace writing. Do not merge them.
- Constructor: `new MetricsAggregator(currentAgent, new MetricsAggregatorHelper())`. `MetricsAggregatorHelper` is stateless and provides `add*` (mutates target) and `clone*` / `mapTo*` (defensive copy) methods.

## Type relaxations

The SDK types in `@opencode-ai/sdk` are too strict. Two local files handle the gap:

- `types.ts` — `LaxAssistantMessage` (used by handlers)
- `metrics/messages.types.ts` — `LlmAssistantMessage` (used by the aggregator)

Both use the `Omit<T, "tokens"> & { tokens?: ... | null }` pattern because the SDK's `AssistantMessage.tokens` is marked required but LLM-error messages arrive without it. Do not "tighten" these — the relaxation is intentional.

## Test patterns

Tests live in `../test/server/`. The runner is `node:test` with `node:assert/strict` — no Jest, no Vitest. `tsc --noEmit` does not type-check tests (`tsconfig.json` excludes `src/test`).

### Server handler tests (most common pattern)

- Use `mock.fn()` from `node:test` to mock `writeTrace` and `writeTraceError`. Inject into the handler constructor.
- Constructor argument is `as any` cast to bypass the full `TraceHelper` interface — this is the standard pattern, not a smell.
- Fixture factories with an `overrides` parameter (e.g. `makeMsg(overrides)`) reduce boilerplate.
- Assert on `mock.calls[0]?.arguments[0]` to check the event payload shape.

```ts
const writeTrace = mock.fn();
const handler = new LlmCallHandler({ writeTrace } as any, new Map());
handler.handle(makeMsg({ finish: "stop" }));
assert.equal(writeTrace.mock.calls.length, 1);
```

### Module-mocking (only used for `TraceHelper`)

- `mock.module()` from `node:test` mocks `fs` and `os` at the module loader level.
- Use a `fresh()` helper that clears the require cache and re-imports the module to pick up mocked dependencies.
- Call `mock.restoreAll()` at the start of each test for a clean slate.

### Aggregator tests

- No mocking. Use fixture factory functions (`makeLlmCallEvent`, `makeLlmErrorEvent`, `makeToolCallEvent`, `makeSessionCreatedEvent`) with `overrides`.
- Construct a real `MetricsAggregator` and call `.ingest(...)` and `.snapshot()`.

## Adding a new handler

1. Create `handlers/<name>.handler.ts` exporting a class implementing `Handler`.
2. Write a test in `../test/server/handlers/<name>.handler.test.ts` covering the relevant state shapes and guards.
3. Register it in `setupEventHandlers()` in `agent-monitor.ts`. Mind the registration order: if it depends on the `currentAgent` map, register after `UserMessageHandler`; if it must run before other handlers for the same event, register earlier in the chain.
4. Add the new trace event type to `TraceEventType` in `enums.ts` if needed.

## Quirks worth remembering

- `ToolCallHandler` is the only handler that uses raw string literals (`"tool"`, `"completed"`, `"error"`) instead of the `PartType`/`PartStatus` enums. This is a known inconsistency — other handlers use enums. Don't copy the strings.
- The `event` hook calls **both** `eventHandler.handle(event)` and `metricsAggregator.ingest(event)`. Do not bypass one.
- `currentAgent` is mutated across async boundaries. Handlers that read from it should treat the read as the value at the time of execution, not as a snapshot.
- All file writes are sync. Do not "optimize" to async — ordering matters and the SDK event loop is fine with blocking.
