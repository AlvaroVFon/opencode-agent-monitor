# AGENTS.md — @alvarovfon/opencode-agent-monitor

## Quick start

```bash
pnpm install --ignore-scripts
pnpm build          # tsup → dist/{agent-monitor,tui}.js
pnpm lint           # oxlint src
pnpm format:check   # oxfmt --check .
pnpm test           # node --import tsx --experimental-test-module-mocks --test 'src/test/**/*.test.ts'
pnpm format         # oxfmt .
pnpm check          # oxlint + oxfmt --check + build + test (global state)
pnpm metrics        # tsx src/cli/main.ts stats (aggregate trace.jsonl → markdown/json)
pnpm test:prod      # tsx scripts/test-prod.mts
```

## Architecture

- **OpenCode V2 dual plugin**, file-communicating: server plugin (`src/server/agent-monitor.ts`, `export .`) subscribes to `ctx.event.subscribe()` + tool hooks and writes per-session `{sessionId}.jsonl` files; TUI plugin (`src/tui/agent-monitor-tui.tsx`, `export ./tui`) reads them incrementally via `SessionWatcher`. No in-memory sharing. Cross-product contracts in `src/shared/metrics.types.ts`.
- **Single aggregation**: `AggregatorStore` (TUI, ingests JSONL events) feeds the TUI and the CLI. The V1 server-side `MetricsAggregator` was removed in 2.0.0.
- **Event mapping**: V2 events are translated by handlers in `src/server/handlers/`; the authoritative mapping lives in `src/server/README.md`.

## Conventions

- **All code follows object-oriented programming (OOP) principles.** Classes and objects are the primary building blocks; pure functions are used only for stateless formatting and data transformation.
- **Export naming — PascalCase class, camelCase singleton.** Classes use PascalCase (`CliAggregator`, `TraceReader`, `AggregateHelper`). When a single instance is exported from the same file, it uses camelCase matching the class name (`cliAggregator`, `traceReader`, `aggregateHelper`).
- **Instantiation strategy depends on layer.** CLI and TUI helpers export a singleton instance inline (they are leaf utilities). Server-side helpers export only the class; instances are created in `src/server/wire/` factories. Both approaches are valid.

## Key conventions

| Rule                                                          | Source                                       |
| ------------------------------------------------------------- | -------------------------------------------- |
| Commits must follow conventional commits (lower-case subject) | `commitlint.config.cjs` + husky `commit-msg` |
| Pre-commit runs `lint-staged` (→ `oxfmt && oxlint` on staged) | `.husky/pre-commit`                          |
| `develop` is default branch; `main` is release-only           | `ROADMAP.md`, CI workflows                   |
| PR to `develop` triggers CI (lint → format:check → test)      | `.github/workflows/ci.yml`                   |
| Push to `main` triggers semantic-release → npm publish        | `.github/workflows/release.yml`              |
| `pnpm check` runs lint + format:check + build + test          | `package.json` (scripts.check)               |

## Test quirks

- **Tests are NOT type-checked** (`tsconfig.json` excludes `src/test/`). Run `pnpm test` to catch type errors in tests.
- **Solid JSX components have no unit tests** (ADR-003). Only pure formatters and data logic get TDD coverage. Components are validated manually in the TUI host.
- Test runner is Node's built-in `node:test` with `--experimental-test-module-mocks` for mocking.

## Build notes

- `tsup` bundles `format: ["esm"]` with `splitting: false`. JSX is handled by `esbuild-plugin-solid` with `@opentui/solid` as the JSX runtime.
- `tsconfig.json` uses `"jsx": "preserve"` so `tsc --noEmit` can parse `.tsx` without transforming. Dev-time transpilation is done by `tsx`.
- `scripts/` files are `.mts` — run with `tsx`, not `node --import tsx`.

## Local development

`pnpm test:prod` generates a local plugin **package** at
`~/.config/opencode/.agent-monitor-prod/agent-monitor/` (`package.json` with
`exports["."]` + `exports["./tui"]`, `index.js`, `tui.js`) and points
`~/.config/opencode/opencode.json` at it, backing the original up. Only
`opencode.json` is rewritten: the V2 CLI loads the `./tui` export of every
active server plugin by itself, so `cli.json` needs no entry. There is no
project-local `.opencode/opencode.json` in this repo.

```bash
pnpm install --ignore-scripts
pnpm build
```

TUI trace dir resolution order: `options.traceDir` → `AGENT_MONITOR_DIR` env → `~/.config/opencode/.tracing`.

## Constraints

- Node >=24, pnpm 11.7.0
- `tsc --noEmit` for type-checking (does NOT check `src/test/`); `oxlint` for linting; `oxfmt` for formatting
- Peer deps: OpenCode V2 plugin API (`@opencode/plugin` 2.1.x) and `@opentui/{core,solid} >=0.6.8`
- No `zod` — tool hook was removed (Phase 3)

## Project status (as of 2026-10-23)

v2.0.0 targets OpenCode V2. A.3 (per-session files), A.2 (schema v1), C.1 (HTML dashboard), and the V2 plugin migration are completed. Next: Phase B (Deep Insights — skill/tool analytics, p95 latency, write buffer).
