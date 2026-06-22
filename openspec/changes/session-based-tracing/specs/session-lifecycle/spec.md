# Session Lifecycle Specification

## Purpose

Manage per-session `WriteStream` ownership — create on first write, close on process exit, route all events (including errors) to a single per-session JSONL file.

## Requirements

### Requirement: Session owns a WriteStream in append mode

The system MUST create a `fs.WriteStream` in append mode when the first `write()` call is made for a given sessionID.

#### Scenario: First write creates the stream

- GIVEN a new `Session` with a valid sessionID
- WHEN `write(event)` is called for the first time
- THEN a `WriteStream` is opened in append mode at `{traceDir}/{sanitizedID}.jsonl`
- AND the event is serialized with `schemaVersion: 1` and written

#### Scenario: Subsequent writes reuse the open stream

- GIVEN a Session that has already written one event
- WHEN `write(event)` is called again
- THEN the same `WriteStream` is reused without reopening
- AND the new event is appended

### Requirement: Session serializes events with schemaVersion

Each event written via `Session.write()` MUST include `schemaVersion: 1` in the serialized JSON line.

#### Scenario: schemaVersion is present in every line

- GIVEN a Session with an active WriteStream
- WHEN `write({ type: "llm_call", ... })` is called
- THEN the written JSON line contains `"schemaVersion":1`

### Requirement: Session.close() ends the stream cleanly

The system MUST call `stream.end()` on close, drain pending writes, and release the file descriptor.

#### Scenario: Close flushes and ends

- GIVEN a Session with buffered writes
- WHEN `close()` is called
- THEN `stream.end()` is invoked
- AND no further writes are accepted (MUST throw or silently drop)

### Requirement: Session ID is sanitized for filenames

The system MUST transform a raw sessionID (UUID) into a filename-safe string by stripping or replacing path separators and special characters.

#### Scenario: UUID is sanitized

- GIVEN a sessionID `"550e8400-e29b-41d4-a716-446655440000"`
- WHEN `write(event)` is called
- THEN the output filename is `550e8400-e29b-41d4-a716-446655440000.jsonl`

#### Scenario: Malicious session ID is sanitized

- GIVEN a sessionID with path separators like `"../../etc/passwd"`
- WHEN `write(event)` is called
- THEN the filename is sanitized (e.g. `........etc.passwd.jsonl`)
- AND no directory traversal occurs

### Requirement: Stream errors are logged to stderr

If the WriteStream emits an `error` event, the Session MUST log the error message to `process.stderr` and MUST NOT crash the process.

#### Scenario: WriteStream error is caught

- GIVEN a Session with an active WriteStream
- WHEN the stream emits an `error` event (e.g., disk full)
- THEN the error message is written to `process.stderr`
- AND the process continues running
