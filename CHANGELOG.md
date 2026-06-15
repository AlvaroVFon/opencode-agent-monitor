# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.1] - 2026-06-15

### Added
- `ToolCallHandler` — traces tool calls (completed and error) with `tool`, `callID`, `status`, `durationMs` and optional `error` field. Tool parts in `pending` or `running` state are ignored.
- `LICENSE` (MIT) and `CHANGELOG.md`.
- `prepublishOnly` script that runs `lint` + `test` before publish.
- `ROADMAP.md` with the full multi-phase plan (metrics, tool, CLI).

### Fixed
- `LlmCallHandler` now discards `message.updated` events without `time.completed`, preventing traces with `durationMs: null` for unfinished LLM calls. Test updated accordingly.

## [0.1.0] - 2026-06-15

### Added
- Initial release.
- Trace events: `session_created`, `session_error`, `llm_call`, `llm_error`, `agent_delegation`.
- Duel output: `trace.jsonl` (all events) + `trace.errors.jsonl` (errors only).
- Defensive I/O: failures in main trace are duplicated to error file; failures in error file are swallowed to keep the OpenCode session alive.
- Configurable `traceDir` option (defaults to `~/.config/opencode/.tracing`).
- 42 unit tests covering every handler, the event registry, the dispatcher, and both trace helpers.
