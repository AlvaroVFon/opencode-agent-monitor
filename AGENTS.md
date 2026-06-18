# AGENTS.md — @alvarovfon/opencode-agent-monitor

## Quick start

```bash
pnpm install --ignore-scripts
pnpm build          # tsup → dist/{agent-monitor,tui}.js
pnpm lint           # tsc --noEmit (does NOT check src/test/)
pnpm format:check   # prettier --check .
pnpm test           # node --import tsx --experimental-test-module-mocks --test 'src/test/**/*.test.ts'
pnpm format         # prettier --write .
pnpm metrics        # tsx scripts/metrics.mts (aggregate trace.jsonl → markdown/json)
pnpm test:prod      # tsx scripts/test-prod.mts
```

## Architecture

- **Dual-plugin**, file-communicating: server plugin (`src/server/agent-monitor.ts`, `export .`) writes `trace.jsonl`; TUI plugin (`src/tui/agent-monitor-tui.tsx`, `export ./tui`) reads it incrementally via `JsonlTailer`. No in-memory sharing. Cross-product contracts in `src/shared/metrics.types.ts`.
- **Dual aggregation**: `MetricsAggregator` (server, ingests SDK events) and `AggregatorStore` (TUI, ingests JSONL events) produce compatible `MetricsSnapshot` / `Aggregate` shapes but handle different input formats.

## Conventions

- **All code follows object-oriented programming (OOP) principles.** Classes and objects are the primary building blocks; pure functions are used only for stateless formatting and data transformation.

## Key conventions

| Rule                                                          | Source                                       |
| ------------------------------------------------------------- | -------------------------------------------- |
| Commits must follow conventional commits (lower-case subject) | `commitlint.config.cjs` + husky `commit-msg` |
| Pre-commit runs `lint-staged` then `prettier --write .`       | `.husky/pre-commit`                          |
| `develop` is default branch; `main` is release-only           | `ROADMAP.md`, CI workflows                   |
| PR to `develop` triggers CI (lint → format:check → test)      | `.github/workflows/ci.yml`                   |
| Push to `main` triggers semantic-release → npm publish        | `.github/workflows/release.yml`              |
| `prepublishOnly` runs build → lint → format:check → test      | `package.json`                               |

## Test quirks

- **Tests are NOT type-checked** (`tsconfig.json` excludes `src/test/`). Run `pnpm test` to catch type errors in tests.
- **Solid JSX components have no unit tests** (ADR-003). Only pure formatters and data logic get TDD coverage. Components are validated manually in the TUI host.
- Test runner is Node's built-in `node:test` with `--experimental-test-module-mocks` for mocking.

## Build notes

- `tsup` bundles `format: ["esm"]` with `splitting: false`. JSX is handled by `esbuild-plugin-solid` with `@opentui/solid` as the JSX runtime.
- `tsconfig.json` uses `"jsx": "preserve"` so `tsc --noEmit` can parse `.tsx` without transforming. Dev-time transpilation is done by `tsx`.
- `scripts/` files are `.mts` — run with `tsx`, not `node --import tsx`.

## Local development

Plugin config in `.opencode/opencode.json` and `.opencode/tui.json` point to source files in `src/`. For production testing, use absolute paths to `dist/` files in your `~/.config/opencode/` configs.

```bash
pnpm install --ignore-scripts
pnpm build
```

TUI trace dir resolution order: `options.traceDir` → `AGENT_MONITOR_DIR` env → `~/.config/opencode/.tracing`.

## Constraints

- Node >=24, pnpm 11.7.0
- No ESLint — `tsc --noEmit` is the only linter
- No `zod` — tool hook was removed (Phase 3)
- Peer deps: `@opentui/{core,keymap,solid}` (not auto-installed; set `.npmrc` `auto-install-peers=true`)

## Project status (as of 2026-06-17)

v0.0.2 published. Phase 2.5 (extended aggregator) and Phase 5.a (schemaVersion) are next pending work.
