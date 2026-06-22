# CLI TraceReader Specification

## Purpose

Rewrite the CLI `TraceReader` to read from per-session files instead of hardcoded `trace.jsonl`/`trace.errors.jsonl` paths.

## Requirements

### Requirement: readEvents(dir) lists, parses, and sorts

The system MUST call `listSessionFiles(dir)` to discover files, parse each via `readSessionFile`, merge all events, and sort by `timestamp` ascending.

#### Scenario: Reads all session files in directory

- GIVEN a directory with `a.jsonl` (2 events) and `b.jsonl` (3 events)
- WHEN `readEvents(dir)` is called
- THEN all 5 events are returned sorted by timestamp

#### Scenario: Empty directory

- GIVEN an empty directory
- WHEN `readEvents(dir)` is called
- THEN an empty array is returned (no throw)

#### Scenario: Directory with non-JSONL files

- GIVEN a directory with `trace.jsonl` (old format) and `readme.txt`
- WHEN `readEvents(dir)` is called
- THEN only `trace.jsonl` is read (matches `*.jsonl` glob)
- AND `readme.txt` is ignored

### Requirement: No hardcoded file paths

The system MUST NOT reference `trace.jsonl` or `trace.errors.jsonl` by name. All file discovery goes through `listSessionFiles`.

#### Scenario: Old format files are not hardcoded

- GIVEN a directory containing only `trace.jsonl`
- WHEN `readEvents(dir)` is called
- THEN it is discovered via `listSessionFiles` glob, not hardcoded string
- AND events are returned normally

### Requirement: readJsonl utility kept but accepts arbitrary paths

The system MUST keep `readJsonl<T>(path)` as a utility that parses any JSONL file, usable by both `readEvents` and potential external callers.

#### Scenario: readJsonl parses arbitrary file

- GIVEN a valid JSONL file at any path
- WHEN `readJsonl(path)` is called with a type parameter
- THEN it returns parsed typed objects
