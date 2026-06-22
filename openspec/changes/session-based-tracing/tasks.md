# Tasks: Session-Based Tracing

## Review Workload Forecast

| Field                   | Value                                       |
| ----------------------- | ------------------------------------------- |
| Estimated changed lines | 850-1100 across 4 PRs                       |
| 400-line budget risk    | High                                        |
| Chained PRs recommended | Yes (force-chained)                         |
| Suggested split         | PR 1 → PR 2 → PR 3 → PR 4 (stacked-to-main) |
| Delivery strategy       | force-chained                               |
| Chain strategy          | stacked-to-main                             |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

### Suggested Work Units

| Unit | Goal                                                                   | PR   | Base | Lines |
| ---- | ---------------------------------------------------------------------- | ---- | ---- | ----- |
| 1    | Foundation: `session-fs` + `AgentDelegationEvent` type                 | PR 1 | main | ~150  |
| 2    | Server write path: `Session` + `TraceHelper` + handlers + `beforeExit` | PR 2 | main | ~470  |
| 3    | Read path: `AggregatorStore` + `SessionWatcher` + TUI + cleanup        | PR 3 | main | ~500  |
| 4    | CLI: `TraceReader` rewrite                                             | PR 4 | main | ~110  |

## Phase 1: Foundation (PR 1)

- [x] 1.1 `session-fs-tests` — RED: `src/test/shared/session-fs.test.ts` for all `specs/session-file-io` scenarios.
- [x] 1.2 `session-fs-helpers` — GREEN: `src/shared/session-fs.ts` with `sanitizeSessionId`, `sessionFilePath`, `listSessionFiles`, `readSessionFile` (ENOENT → `[]`).
- [x] 1.3 `agent-delegation-type-fix` — `src/shared/trace-events.types.ts`: add `sessionID: string` to `AgentDelegationEvent`, drop index signature; `pnpm test` clean.

## Phase 2: Server Write Path (PR 2)

- [x] 2.1 `session-tests` — RED: `src/test/server/session.test.ts` for all `specs/session-lifecycle` scenarios.
- [x] 2.2 `session-class` — GREEN: `src/server/session.ts` with `ctor(traceDir, sessionID)`, `write`, `close()`. Lazy `createWriteStream({flags:'a'})`, inject `schemaVersion: 1`, stream error → stderr, close idempotent.
- [x] 2.3 `trace-helper-tests` — RED: rewrite `src/test/server/helpers/trace.helpers.test.ts` for `Map<sessionID, Session>`, idempotent close, no `writeTraceError`.
- [x] 2.4 `trace-helper-rewrite` — GREEN: rewrite `src/server/helpers/trace.helpers.ts` — `Map<string, Session>`, drop `appendFileSync` and `writeTraceError`/`traceFilePath`/`traceErrorsPath`.
- [x] 2.5 `handler-cleanup` — drop `writeTraceError` in `session-error.handler.ts` + `llm-error.handler.ts`; tests assert `writeTrace.mock.calls.length === 1`.
- [x] 2.6 `beforeexit-hook` — `process.on('beforeExit', () => traceHelper.close())` in `agent-monitor.ts`; smoke test in `agent-monitor.test.ts`.

## Phase 3: Read Path (PR 3)

- [x] 3.1 `aggregator-store-batch-tests` — RED: extend `aggregator-store.test.ts` for silent ingest + flush cases.
- [x] 3.2 `aggregator-store-batch` — GREEN: add `opts?: {silent?: boolean}` to `ingest()`, gate `emitSnapshot`; add `flush()`.
- [x] 3.3 `session-watcher-tests` — RED: `src/test/tui/session-watcher.test.ts` porting `jsonl-tailer` scenarios (append, truncate, rotate, poll, ENOENT, malformed, cursor).
- [x] 3.4 `session-watcher` — GREEN: `src/tui/session-watcher.ts` with `ctor(traceDir, sessionID, opts)`, `start(cursor?)`, `stop()`, `cursor` getter. `sessionFilePath` + `fs.watch(file)` + 250 ms poll; single-file.
- [x] 3.5 `tui-wiring` — replace `JsonlTailer` in `agent-monitor-tui.tsx` with `SessionWatcher` on `sessionId` signal; per-session KV cursor; silent batch + `flush()` on init. Update e2e.
- [x] 3.6 `cleanup-jsonl-tailer` — delete `src/tui/jsonl-tailer.ts` + test; grep stale imports; `pnpm lint && pnpm format:check && pnpm test`.

## Phase 4: CLI (PR 4)

- [ ] 4.1 `cli-trace-reader-tests` — RED: rewrite `reader.test.ts` for per-session glob + sort (list+read+sort, empty, `readme.txt` ignored, legacy `trace.jsonl` via glob, `readJsonl<T>`).
- [ ] 4.2 `cli-trace-reader` — GREEN: rewrite `src/cli/reader.ts` `readEvents(dir)` = `listSessionFiles` + `readSessionFile` + sort by `timestamp`; keep `readJsonl<T>` public.
- [ ] 4.3 `cli-e2e` — `pnpm test && pnpm test:prod`; verify `pnpm metrics` aggregates from per-session files.
