# Session Watching Specification

## Purpose

Tail a single per-session JSONL file, resolved dynamically from an active `sessionID`. Emit parsed events via the same onLine/onError contract as the replaced `JsonlTailer`. Support session switching by creating a new watcher instance.

## Requirements

### Requirement: SessionWatcher tails a single file resolved from sessionID

The system MUST resolve the file path from `traceDir` + `sessionID` using `sessionFilePath()` and tail exactly that file. It does NOT scan or watch a directory.

#### Scenario: Start tails the session file from cursor

- GIVEN a trace directory with `{sessionId}.jsonl` containing 3 events
- WHEN `SessionWatcher` is constructed with that `sessionId` and `start(0)` is called
- THEN an `fs.watch` is set up on the resolved file path
- AND a polling interval (default 250ms) begins
- AND all 3 events are emitted via `onLine` in order
- AND the cursor is positioned at end-of-file

#### Scenario: Start with cursor continues from byte offset

- GIVEN a `{sessionId}.jsonl` with 10 events and cursor at byte 500
- WHEN `start(500)` is called
- THEN only events after byte 500 are emitted
- AND the cursor advances to end-of-file

#### Scenario: Empty session file at start

- GIVEN `{sessionId}.jsonl` is empty
- WHEN `start()` is called
- THEN no events are emitted (no error)
- AND the watcher remains active for future appends

#### Scenario: Session file does not exist

- GIVEN no file for `sessionId`
- WHEN `start()` is called
- THEN no events are emitted (no error, ENOENT silent)
- AND the watcher stays active — when the file appears, it picks it up

### Requirement: On file change, read only new lines

When the file emits a `change` event, the system MUST read only bytes beyond the current cursor position and parse new JSON lines.

#### Scenario: Append detected and consumed

- GIVEN a session file with cursor at EOF
- WHEN a new line is appended to the file
- THEN the new line is read and emitted via `onLine`
- AND the cursor advances past the new data

#### Scenario: Empty lines in appended data

- GIVEN a session file with cursor at EOF
- WHEN blank lines are appended
- THEN no events are emitted
- AND the cursor advances past the blank content

#### Scenario: File truncated

- GIVEN a session file with cursor at 1000 bytes
- WHEN the file is truncated to 500 bytes
- THEN the cursor resets to 0
- AND the entire file is re-read

### Requirement: Cursor is exposed for KV persistence

The `SessionWatcher` MUST expose a `cursor` getter so the TUI can persist it per session.

#### Scenario: Cursor returned after read

- GIVEN a session file with 100 bytes read
- WHEN `watcher.cursor` is queried
- THEN it returns 100 (or current byte position)

### Requirement: Same onLine/onError callback contract as JsonlTailer

The `SessionWatcher` constructor MUST accept `{ onLine?: (line: unknown) => void, onError?: (err: Error) => void }`.

#### Scenario: Parsed lines passed to onLine

- GIVEN a session file with a valid JSON line
- WHEN the line is read
- THEN `onLine` is called with the parsed object

#### Scenario: Malformed JSON line skipped

- GIVEN a session file with a malformed JSON line
- WHEN the line is encountered during read
- THEN the line is silently skipped (no error, no onError call — same as JsonlTailer)
- AND the watcher continues processing subsequent lines

#### Scenario: onError callback throws is caught

- GIVEN a SessionWatcher with an `onError` callback that throws
- WHEN an error occurs
- THEN the throw is caught internally (try/catch)
- AND the watcher does not crash

### Requirement: Session switch via new instance

Session switching is handled by the caller: `stop()` current watcher → create new `SessionWatcher` with new `sessionID` → `start(cursor)`.

#### Scenario: Stop before new session

- GIVEN a watching SessionWatcher for session A
- WHEN `stop()` is called
- THEN the `fs.watch` handle is closed
- AND the polling interval is cleared
- AND no further callbacks fire
- AND a new SessionWatcher for session B can be created and started
