# Session File I/O Specification

## Purpose

Shared stateless helpers for discovering, reading, and sanitizing per-session trace files. Imported by server, TUI, and CLI.

## Requirements

### Requirement: listSessionFiles returns all .jsonl files

The system MUST glob all `*.jsonl` files in a given directory, returning absolute paths sorted alphabetically.

#### Scenario: Directory with session files

- GIVEN a directory containing `a.jsonl`, `b.jsonl`, and `readme.txt`
- WHEN `listSessionFiles(dir)` is called
- THEN it returns `["{dir}/a.jsonl", "{dir}/b.jsonl"]`

#### Scenario: Empty directory

- GIVEN an empty directory
- WHEN `listSessionFiles(dir)` is called
- THEN it returns an empty array

#### Scenario: Non-existent directory

- GIVEN a path that does not exist
- WHEN `listSessionFiles(dir)` is called
- THEN it returns an empty array (no throw)

### Requirement: readSessionFile parses a JSONL file

The system MUST read a session file line by line, parse each line as JSON, and return the array.

#### Scenario: Valid JSONL file

- GIVEN a file with two valid JSON lines
- WHEN `readSessionFile(path)` is called
- THEN it returns an array of two parsed objects

#### Scenario: File with malformed JSON lines

- GIVEN a file containing `{"a":1}\nnot-json\n{"b":2}`
- WHEN `readSessionFile(path)` is called
- THEN malformed lines are silently skipped
- AND the result contains two parsed objects

#### Scenario: Non-existent file

- GIVEN a path that does not exist
- WHEN `readSessionFile(path)` is called
- THEN it returns an empty array (no throw)

### Requirement: sanitizeSessionId is deterministic and filename-safe

The system MUST transform a raw string into a filename-safe string by removing characters unsafe for filenames on Linux and macOS (colons, slashes, null bytes, etc.).

#### Scenario: UUID remains intact

- GIVEN `"550e8400-e29b-41d4-a716-446655440000"`
- WHEN `sanitizeSessionId(input)` is called
- THEN the output equals the input (UUID chars are safe)

#### Scenario: Dots and hyphens are preserved

- GIVEN `"my.session-id_v2"`
- WHEN `sanitizeSessionId(input)` is called
- THEN the output equals the input (safe chars preserved)

#### Scenario: Path separators are replaced

- GIVEN `"../../etc/passwd"`
- WHEN `sanitizeSessionId(input)` is called
- THEN all `/` and `..` patterns are replaced, producing a flat safe string
