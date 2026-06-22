# Session-Based Tracing — Spec Index

| #   | Capability                | File                                      | Purpose                                                                                                      |
| --- | ------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| 1   | session-lifecycle         | `specs/session-lifecycle/spec.md`         | `Session` class — create, write, close WriteStreams per session, log stream errors to stderr                 |
| 2   | session-file-io           | `specs/session-file-io/spec.md`           | Shared helpers: `listSessionFiles`, `readSessionFile`, `sanitizeSessionId`                                   |
| 3   | session-watching          | `specs/session-watching/spec.md`          | `SessionWatcher` — `fs.watch` on trace dir, per-file cursor, batch ingestion on start, polling fallback      |
| 4   | trace-helper-rewrite      | `specs/trace-helper-rewrite/spec.md`      | Replace `appendFileSync` with `Map<sessionID, Session>`, remove `writeTraceError`, close-all on `beforeExit` |
| 5   | aggregator-store-batch    | `specs/aggregator-store-batch/spec.md`    | Silent ingest `{ silent: true }` + `flush()` for batch loading historical events                             |
| 6   | cli-trace-reader          | `specs/cli-trace-reader/spec.md`          | `TraceReader` uses per-session glob + sort, no hardcoded file paths                                          |
| 7   | agent-delegation-type-fix | `specs/agent-delegation-type-fix/spec.md` | Add explicit `sessionID: string` to `AgentDelegationEvent` type                                              |
