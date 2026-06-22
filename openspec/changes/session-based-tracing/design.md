# Design: Session-Based Tracing

## Technical Approach

Replace `trace.jsonl` / `trace.errors.jsonl` sync-write with per-session `WriteStream`. Server owns `Map<sessionID, Session>`. TUI receives `sessionId` from sidebar props, resolves the file via shared utils, and tails **one** file per session via `SessionWatcher` (replaces `JsonlTailer`). CLI `TraceReader` discovers all session files via `session-fs` for one-shot commands.

## Architecture Decisions

| Decision              | Choice                                                                            | Tradeoff                                               | Rationale                                                                                                              |
| --------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| WriteStream lazy-init | Open on first `write()` per session                                               | Tiny overhead on first event                           | Matches `Map<>` get-or-create                                                                                          |
| Error channel         | All events → per-session file; stream errors → `process.stderr`                   | Loses dedicated errors file                            | Spec mandates single source of truth                                                                                   |
| KV cursor persistence | Kept per session file                                                             | Single KV key per session (from `trace.jsonl` one-key) | TUI receives new sessionId → reads from byte 0; on switch, persist cursor for current session, load cursor for new one |
| Watcher backend       | `fs.watch(file)` + 250 ms polling — same as current `JsonlTailer`                 | Single file, no dir-watch complexity                   | TUI tails exactly one file at a time, resolved from active `sessionId`                                                 |
| Initial load          | Read active session file from byte 0, batch-ingest `{ silent: true }` + `flush()` | O(N) on session file size only                         | No cross-file merge needed — TUI shows one session at a time                                                           |
| Concurrency           | None — single-threaded Node                                                       | No parallel-write safety                               | Handlers run serially                                                                                                  |

## Module Designs

| Module                        | File                                                             | Action                              | API & Behavior                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ----------------------------- | ---------------------------------------------------------------- | ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Session`                     | `src/server/session.ts`                                          | Create                              | `ctor(dir,id)`, `write(event)`, `close()`. Lazy `WriteStream`, `closed: boolean`. Injects `schemaVersion: 1`. `stream.on("error")` → `process.stderr`. `close` idempotent.                                                                                                                                                                                                                                                                     |
| `TraceHelper`                 | `src/server/helpers/trace.helpers.ts`                            | Modify                              | `ctor(traceDir?)`, `write(event)`, `close()`. `Map<string, Session>`, `dirEnsured` cache. `write` → `getOrCreate(sessionID).write(event)`. `close` iterates + clears. **Removes** `writeTraceError`, `traceFilePath`, `traceErrorsPath`. No locks (single-threaded Node).                                                                                                                                                                      |
| `Session`/`LlmError` handlers | `src/server/handlers/trace/{session-error,llm-error}.handler.ts` | Modify                              | Drop second `writeTraceError` call.                                                                                                                                                                                                                                                                                                                                                                                                            |
| Server wiring                 | `src/server/agent-monitor.ts`                                    | Modify                              | `process.on("beforeExit", () => traceHelper.close())`.                                                                                                                                                                                                                                                                                                                                                                                         |
| `session-fs` helpers          | `src/shared/session-fs.ts`                                       | Create                              | Pure. `sanitizeSessionId`: `id.replace(/[^A-Za-z0-9._-]/g, "_")`. `listSessionFiles`: `readdir` + `.jsonl` filter + absolute + sort; `[]` on ENOENT. `readSessionFile`: split on `\n`, `JSON.parse`, silently skip malformed/empty; `[]` on ENOENT.                                                                                                                                                                                            |
| `SessionWatcher`              | `src/tui/session-watcher.ts`                                     | Create (replaces `jsonl-tailer.ts`) | `ctor(traceDir, sessionID, { onLine, onError, pollIntervalMs? })`, `start(cursor?)`, `stop()`. Resolves file path via `sessionFilePath(traceDir, sessionID)`. State: single `{ cursor, buffer, head }`. `start`: read file from cursor or byte 0 → emit lines → `fs.watch(file)` + `setInterval(poll, 250)`. Switch session: `stop()` old watcher → new `SessionWatcher` with new `sessionID` → `start()`. Cursor persisted per session in KV. |
| `AggregatorStore`             | `src/tui/aggregator-store.ts`                                    | Modify                              | `ingest(event, opts?: { silent?: boolean })` skips `emitSnapshot` when `opts.silent`. New `flush()` calls it once. Default `ingest(event)` unchanged.                                                                                                                                                                                                                                                                                          |
| `TraceReader`                 | `src/cli/reader.ts`                                              | Modify                              | `readEvents(dir)` = list + flatMap(read) + sort by timestamp. Keep `readJsonl<T>(path)` public.                                                                                                                                                                                                                                                                                                                                                |
| `AgentDelegationEvent`        | `src/shared/trace-events.types.ts`                               | Modify                              | Add `sessionID: string`; drop `[key: string]: unknown`. Handler already writes it.                                                                                                                                                                                                                                                                                                                                                             |

## Data Flow

```
SDK event → handler → traceHelper.write → Session.write → {dir}/{id}.jsonl → beforeExit → close

TUI start → resolvePath(id) → read from cursor → silent ingest + flush → setSnapshot
        → fs.watch(file) + poll → onLine → store.ingest
        → on sessionSwitch: persistCursor(id) → stop() → new SessionWatcher(id) → start(cursor)

CLI → readEvents → listSessionFiles → readAll + sortByTimestamp → cliAggregator
```

## File Changes

**Create**: `src/server/session.ts`; `src/shared/session-fs.ts`; `src/tui/session-watcher.ts`; `src/test/tui/session-watcher.test.ts`.
**Modify**: `src/server/helpers/trace.helpers.ts`; `src/server/agent-monitor.ts`; `src/server/handlers/trace/session-error.handler.ts` + `llm-error.handler.ts`; `src/tui/agent-monitor-tui.tsx`; `src/tui/aggregator-store.ts`; `src/cli/reader.ts`; `src/shared/trace-events.types.ts`.
**Modify (tests)**: `src/test/server/helpers/trace.helpers.test.ts`; `src/test/server/handlers/session-error.handler.test.ts` + `llm-error.handler.test.ts`; `src/test/cli/reader.test.ts`.
**Delete**: `src/tui/jsonl-tailer.ts`; `src/test/tui/jsonl-tailer.test.ts`.

## Interfaces / Contracts

```ts
// src/server/session.ts
export class Session {
  constructor(traceDir: string, sessionID: string);
  write(event: object): void;
  close(): void;
}

// src/shared/session-fs.ts
export function sanitizeSessionId(id: string): string;
export function sessionFilePath(dir: string, id: string): string;
export function listSessionFiles(dir: string): string[];
export function readSessionFile(path: string): unknown[];

// src/tui/session-watcher.ts
export class SessionWatcher {
  constructor(traceDir: string, sessionID: string, opts?: {
    pollIntervalMs?: number;
    onLine?: (line: unknown) => void;
    onError?: (err: Error) => void;
  });
  start(cursor?: number): void;
  stop(): void;
  get cursor(): number;  // current byte position (for persistence)
}

// src/tui/aggregator-store.ts (additions)
ingest(event: TraceEvent, opts?: { silent?: boolean }): void;
flush(): void;
```

## Testing Strategy

| Layer                                        | Approach                                                                                                                                                                              |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Session`                                    | Real `WriteStream` against `mkdtempSync`; spy `process.stderr.write`. First write creates stream; `schemaVersion` injected; close idempotent; stream error → stderr.                  |
| `TraceHelper`                                | Fake `Session` via `mock.module`, or real `Session` in temp dir. Get-or-create per sessionID; `close()` empties map.                                                                  |
| `session-fs`                                 | Direct unit tests on temp dirs, no mocks. UUID passthrough; `..` neutralized; glob; malformed skip; ENOENT.                                                                           |
| `SessionWatcher`                             | `waitFor` + `mkdtempSync` from existing `jsonl-tailer.test.ts`. Same single-file pattern: append detection, truncation, rotation, polling, ENOENT silent. No multi-file tests needed. |
| `AggregatorStore` / `TraceReader` / Handlers | Add cases to `aggregator-store.test.ts`; rewrite `reader.test.ts`; assert `writeTrace.mock.calls.length === 1`.                                                                       |
| E2E                                          | One round-trip in `agent-monitor.test.ts`: `AgentMonitor` writes `.jsonl`; `SessionWatcher` picks up.                                                                                 |

## Migration / Rollout

v0.3.0 → v1.0.0 breaking. Old `trace.jsonl` / `trace.errors.jsonl` silently ignored. README + ROADMAP: replace "persistent cursor" with "per-session cursor", add "per-session file isolation". No data migration; v0.x users notified via release notes.

## Open Questions

- [ ] `AgentDelegationEvent.sessionID`: strict `string` or `string | null`? Check `subtask-delegation.handler`.
- [ ] Session switch in TUI: how does the plugin detect `sessionID` changes from sidebar props? Reactivity via Solid signal on the prop.
- [ ] KV key format for per-session cursors: `agent_monitor_cursor_{safeSessionId}` or namespaced key?
