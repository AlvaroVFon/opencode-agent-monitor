# TraceHelper Rewrite Specification

## Purpose

Replace `appendFileSync` with per-session `Session` management. Remove `writeTraceError` — all events (including write errors) route to the session file.

## Requirements

### Requirement: TraceHelper manages a Map<sessionID, Session>

The system MUST maintain an internal `Map<string, Session>` that provides get-or-create semantics per sessionID.

#### Scenario: Get or create session on first event

- GIVEN a TraceHelper with no active sessions
- WHEN `write(event)` is called with sessionID `"abc"`
- THEN a new Session for `"abc"` is created and stored
- AND the event is written to that session

#### Scenario: Existing session is reused

- GIVEN a TraceHelper that already has a Session for `"abc"`
- WHEN `write(event)` is called with the same sessionID
- THEN the existing Session is reused
- AND no second stream is opened

### Requirement: close() closes all sessions on process.beforeExit

The system MUST iterate all active sessions, call `close()` on each, and clear the internal map.

#### Scenario: All sessions closed on beforeExit

- GIVEN a TraceHelper with 3 active sessions
- WHEN `close()` is called (bound to `process.beforeExit`)
- THEN all 3 sessions are closed
- AND the internal map is empty afterward

#### Scenario: close() is idempotent

- GIVEN a TraceHelper after `close()` has been called
- WHEN `close()` is called again
- THEN no error is thrown
- AND no sessions are double-closed

### Requirement: No writeTraceError method

The system MUST NOT expose a `writeTraceError()` method. Write errors that occur must be logged to `process.stderr` from within the Session's error handler.

#### Scenario: Write error does not create a second file

- GIVEN a Session whose WriteStream encounters an error
- WHEN the error occurs
- THEN the error is logged to stderr
- AND no separate error JSONL file is created
- AND no `writeTraceError` or equivalent method exists

### Requirement: All events go to session files

Every event — including `session_error` events — MUST be written to the same per-session JSONL file as other events for that sessionID.

#### Scenario: session_error goes to session file

- GIVEN a Session for sessionID `"abc"`
- WHEN a `{ type: "session_error", sessionID: "abc" }` event is written
- THEN the event is appended to `{traceDir}/abc.jsonl`
- AND no separate errors file is used
