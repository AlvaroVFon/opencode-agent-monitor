# Proposal: Session-Based Tracing

## Intent

Replace single-file synchronous JSONL with per-session streams. `appendFileSync` blocks the event loop, fixed `trace.jsonl` prevents session isolation, `writeTraceError` duplicates error paths. Per-session `WriteStream`s fix all three.

## Scope

### In Scope

- `Session` class with `WriteStream` per session — server-side only
- Shared session file utilities (sanitize, list, read)
- `SessionWatcher` replacing `JsonlTailer` in TUI
- Bulk ingest + `flush()` in `AggregatorStore`
- `TraceReader` CLI reads from per-session files
- Breaking change: major version bump, old files ignored

### Out of Scope

- Async buffered writing, compression, dashboard HTML, budget guard, tree-view hierarchies

## Capabilities

### New Capabilities

- `session-lifecycle`: `Session` class — create, write, close streams. Lifecycle tied to process exit.
- `session-file-io`: shared helpers — `sanitizeSessionId`, `sessionFilePath`, `listSessionFiles`, `readSessionFile`.
- `session-watching`: `SessionWatcher` — dir-level `fs.watch`, per-file cursor, bulk ingest on start.

### Modified Capabilities

None — first capability definition pass.

## Approach

`Session` owns a `WriteStream` created on first `write()`. All events go to `{safeSessionId}.jsonl`. `process.on('beforeExit')` calls `traceHelper.close()`.

TUI: `SessionWatcher` watches trace dir. On start: list all `*.jsonl`, batch-ingest via `ingest(evt, {silent: true})` + `flush()`. On `fs.watch` change: read new lines per file. No KV cursor persistence.

CLI: `readEvents(dir)` → `listSessionFiles()` → parse → merge chronologically.

## Affected Areas

| Area                                  | Impact  | Description                  |
| ------------------------------------- | ------- | ---------------------------- |
| `src/server/session.ts`               | New     | Session + WriteStream        |
| `src/shared/session-fs.ts`            | New     | File discovery helpers       |
| `src/tui/session-watcher.ts`          | New     | Dir watcher                  |
| `src/server/helpers/trace.helpers.ts` | Mod     | Use Session, remove sync     |
| `src/server/agent-monitor.ts`         | Mod     | beforeExit hook              |
| `src/tui/agent-monitor-tui.tsx`       | Mod     | SessionWatcher, no KV cursor |
| `src/tui/aggregator-store.ts`         | Mod     | Silent ingest + flush        |
| `src/cli/reader.ts`                   | Mod     | Per-session glob + sort      |
| `src/shared/trace-events.types.ts`    | Mod     | sessionID on delegation      |
| `src/tui/jsonl-tailer.ts`             | Removed | Replaced by SessionWatcher   |
| `src/test/*` (4 files)                | RW      | New/rewritten tests          |

## Risks

| Risk                       | Likelihood | Mitigation                     |
| -------------------------- | ---------- | ------------------------------ |
| WriteStream leaks on crash | Med        | beforeExit + exit fallback     |
| TUI watch misses on macOS  | Low        | Polling fallback after watch   |
| Existing v0.x users break  | High       | Major bump, optional migration |

## Rollback Plan

Revert to `appendFileSync`: restore `trace.helpers.ts`, `jsonl-tailer.ts`, old `reader.ts`. Keep `trace.jsonl` as fallback during soft rollout.

## Dependencies

- Node 24+ `fs.createWriteStream` (built-in)
- `@opentui/solid` — TUI rendering (unchanged)

## Success Criteria

- [ ] All events land in per-session `{id}.jsonl` — verified by integration test
- [ ] TUI shows same live data — visual regression check
- [ ] `beforeExit` closes all streams cleanly, no `MUST close` warnings
- [ ] All existing tests pass with rewritten test files
