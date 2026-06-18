# ROADMAP.md — `@alvarovfon/opencode-agent-monitor`

> Living document. Defines phases, acceptance criteria, and scope. Updated upon closing each phase.

## Vision

OpenCode plugin that **traces** events to JSONL and, in its second phase, **aggregates and exposes metrics** via tool (consumable by the LLM) and CLI (consumable by humans), focusing on **cost, tokens, latency, and error rate** per `agent` / `model` / `tool`.

## Current state (snapshot as of 2026-06-17)

- ✅ Event tracing: `session_created`, `session_error`, `llm_call`, `llm_error`, `agent_delegation`, `tool_call`, `write_trace_error`
- ✅ Dual output (`trace.jsonl` + `trace.errors.jsonl`) with defensive I/O handling
- ✅ SDK types (`@opencode-ai/sdk`) integrated
- ✅ Published on npm: `@alvarovfon/opencode-agent-monitor@1.0.1`
- ✅ LICENSE (MIT), CHANGELOG managed by release-please
- ✅ `ToolCallHandler` with test (6 cases)
- ✅ Conventional commits + commitlint + husky
- ✅ release-please + GitHub Actions (release + publish consolidated in a single workflow)
- ✅ Prettier + CI workflow (lint, format:check, test) on PRs and push to `main`/`develop`
- ✅ Git Flow with `develop` as default branch
- ✅ CI/CD consolidation: publish.yml removed, release-please.yml as single workflow with validations via prepublishOnly
- ✅ `MetricsAggregator` complete (Phase 2): `bySession` / `byAgent` / `byModel` / `byAgentModel` — 8 tests
- ✅ TUI plugin real-time (Phase 3.5): sidebar panel + fullscreen dialog + `byAgentModel` + derived metrics (30 tests)
- ✅ `scripts/metrics.mts` — removed in favour of CLI stats/export
- ✅ Phases 0 and 1 complete (release-please + first publication)
- ✅ README restructured: TUI as main feature, prominent installation docs
- ✅ `MetricsAggregator` extended with `byTool`, `errors[]`, `snapshot({ filters })`, and formatters (Phase 2.5)
- ❌ No `schemaVersion` on JSONL events (5.a pending)
- ❌ Tool `agent_monitor_stats` removed (does not contribute to data study; TUI already covers display)
- ✅ CLI implemented (replaces `metrics.mts`)
- ⏸ Formal persistence (SQL) pending tradeoff study

---

## Key Metrics — traceability matrix

All metrics the project can generate, classified by implementation status:

| Métrica                            | Estado      | Fuente                            | Consumidor    |
| ---------------------------------- | ----------- | --------------------------------- | ------------- |
| **Coste por sesión**               | ✅          | `bySession`                       | TUI, script   |
| **Coste por agente**               | ✅          | `byAgent`                         | TUI, script   |
| **Coste por modelo**               | ✅          | `byModel`                         | TUI, script   |
| **Coste por agente × modelo**      | ✅          | `byAgentModel`                    | TUI panel     |
| **Tokens totales (input/output)**  | ✅          | `Aggregate`                       | TUI, script   |
| **Cache hit rate**                 | ✅ Derivado | `cacheRead / (input + cacheRead)` | TUI panel     |
| **Coste medio por call**           | ✅ Derivado | `cost / llmCalls`                 | TUI panel     |
| **Tasa de error por agente**       | ✅          | `Aggregate.errors`                | TUI indicator |
| **Llamadas por tool**              | ✅          | `byTool`                          | Script, TUI   |
| **Skills más usados**              | 🔜 **2.7**  | `TraceEventType.SKILL_CALL`       | bySkill       |
| **Errores detallados**             | ✅          | `errors[]`                        | Script, TUI   |
| **Percentiles p50/p95 latencia**   | 🔜 **2.6**  | Ring buffer + `percentile()`      | Snapshot      |
| **Ratio coste/utilidad**           | 🔜 **2.6**  | `cost / completedTasks`           | Snapshot      |
| **Anomalías (spikes, error rate)** | 🔜 **2.6**  | Stateful detector                 | Callback      |
| **Latencia por tool**              | ❌          | Pendiente de diseño               | —             |
| **Coste por sesión exitosa**       | ❌          | Pendiente de diseño               | —             |

**Prioridad inmediata (Phase 2.7):** skill usage tracking.

---

## Phase 0 — Automation (release-please + commitlint + husky)

**Goal:** automatic versioning and changelog from the first `feat:`. Zero manual intervention for releases.

### 0.1 Conventional commits enforcement

- [x] `commitlint.config.cjs` with `@commitlint/config-conventional` + allowed types
- [x] Hook `commit-msg` in `.husky/` validating each commit
- [x] Script `prepare: "husky"` in `package.json`

### 0.2 release-please config (replaced by semantic-release)

- [x] `release-please-config.json` with `releaseType: "node"` and sections by commit type
- [x] `.release-please-manifest.json` with current version (`"0.1.1"`)
- [x] `bumpMinorPreMajor: true` so `feat:` bumps minor even before 1.0
- [x] `bumpPatchForMinorPreMajor: false` to not bump patch for pre-1.0 feat (keeps strict semver)

### 0.3 GitHub workflows

- [x] `.github/workflows/release-please.yml` — opens/updates Release PR on each push to `main` and publishes to npm with validations via `prepublishOnly`
- [x] `.github/workflows/publish.yml` — **removed** (redundant; release-please.yml covers the full cycle)
- [x] Both with `id-token: write` for OIDC trusted publishing

### 0.4 CHANGELOG managed

- [x] `CHANGELOG.md` kept as skeleton; release-please regenerates it on each Release PR
- [x] Removed from manual version management

### 0.5 Publishing with npm token

- [x] `publishConfig.access: public` in `package.json`
- [x] `NODE_AUTH_TOKEN` configured as GitHub secret
- [x] `provenance` removed from `publishConfig` (not used in CI)
- [x] `publish.yml` removed — `release-please.yml` is the single publication workflow

**Closure criteria:** push to `main` with a `feat:` commit opens a Release PR; merging it creates the tag, the GitHub Release, and publishes to npm with npm token.

---

## Phase 1 — Stabilization and first publish ✅ **completed (2026-06-17)**

**Goal:** publishable package, clean code, minimal guaranteed traceability.

| Step                           | Status | Notes                                                                                                                                    |
| ------------------------------ | ------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| 1.1 Commit pending work        | ✅     | `feat: track tool calls and harden llm_call completion check`                                                                            |
| 1.2 Test for `ToolCallHandler` | ✅     | `src/test/server/handlers/tool-call.handler.test.ts` — 6 cases (completed, error, pending/running states, null duration, agent fallback) |
| 1.3 Minimal documentation      | ✅     | `LICENSE` (MIT), `CHANGELOG.md` (managed by semantic-release), `README.md` with Limitations section                                      |
| 1.4 package.json scripts       | ✅     | `format`, `lint`, `prepublishOnly` all present; version initially `0.1.1` → published as `1.0.1`                                         |
| 1.5 `files` and exports        | ✅     | `files: ["dist", ...]` (tsup output); exports `.` and `./tui`; `./trace-helper` removed                                                  |
| 1.6 Cleanup                    | ✅     | `UNHANDLED_EVENT` removed from enum; `MessagePartUpdatedProps` / `LaxAssistantMessage` documented in code                                |
| 1.7 Publication                | ✅     | Published to npm (`1.0.1`, `1.1.0`, `1.1.1`); version reset to `0.0.1` for dev; CI migrated from release-please → semantic-release       |

**Closure criteria:** `npm view @alvarovfon/opencode-agent-monitor` shows published packages (`1.0.1` through `1.1.1`). Current local version reset to `0.0.1` for ongoing development.

---

## Phase 2 — Metrics aggregation layer (v0.2.0) — ✅ **completed (2026-06-16)**

**Goal:** have a `MetricsAggregator` that consumes the same events as `EventHandler` and keeps an in-memory snapshot without touching the current tracing flow.

### 2.1 Design

- ✅ New class `MetricsAggregator` in `src/server/metrics/metrics.aggregator.ts` (shared types in `src/shared/metrics.types.ts`)
- ✅ Receives the same OpenCode events (`message.updated`, `message.part.updated`, `session.created`) in parallel to `EventHandler`
- ✅ Internal state with totals, bySession, byAgent, byModel + window
- ✅ Methods `ingest()`, `snapshot()`, `reset()`

### 2.2 Percentiles — moved to Phase 2.6 (2026-06-17)

- Rationale: the data study confirmed p50/p95 latency as a first-class metric. Percentiles are now part of Phase 2.6.1 (ring buffer + percentiles).

### 2.3 Tests

- ✅ `src/test/server/metrics/metrics.aggregator.test.ts` (8 cases)

### 2.4 Plugin integration

- ✅ `src/server/agent-monitor.ts`: `MetricsAggregator` instantiated and each event passed to `metricsAggregator.ingest(event)` in parallel to `EventHandler`
- ✅ No changes to handlers or `TraceHelper` — additive

**Closure criteria:** ✅ 8 tests green + full suite (89 tests) still green; plugin keeps writing JSONL as before; `MetricsAggregator.snapshot()` available for internal consumers (later used by CLI and TUI).

---

## Phase 2.5 — Extend `MetricsAggregator` with filters, `byTool`, errors, and formatters (v0.3.0) — ✅ **completed (2026-06-17)**

**Goal:** absorb the duplicated aggregation logic from the old `scripts/metrics.mts` into `MetricsAggregator` so that the script, the server-side TUI, and any future consumer share a single source of truth.

### 2.5.1 Changes

| Change                                                      | Status |
| ----------------------------------------------------------- | ------ |
| `byTool: Map<string, ToolStats>` in aggregator              | ✅     |
| `errors: ErrorEntry[]` capped at 1000                       | ✅     |
| `sessionErrors` tracking in totals                          | ✅     |
| `snapshot({ since, groupBy, sessionID, top })`              | ✅     |
| Formatters (markdown, json, csv)                            | ✅     |
| `scripts/metrics.mts` refactored (removed in favour of CLI) | ✅     |
| TUI `AggregatorStore` parallel byTool + errors              | ✅     |
| 169 tests (27 new + 142 existing) green                     | ✅     |

### 2.5.2 New types (shared/metrics.types.ts)

```ts
ToolStats = { calls: number; errors: number; durationMs: number }
ErrorEntry = { sessionID: string; type: string; message: string; timestamp: number }
```

### 2.5.3 Test coverage

- `byTool`: separate tools, completed vs error, aggregate merging (3 tests)
- `errors[]`: from llm_error, tool_call error, session_error, cap at 1000 (4 tests)
- `snapshot({ since })`: before window returns zeroed, after window returns data (2 tests)
- `snapshot({ sessionID })`: filters correctly, nonexistent returns empty (2 tests)
- `snapshot({ groupBy })`: agent-only, tool-only (2 tests)
- `snapshot({ top })`: top-N by cost (1 test)
- `snapshot()` without args: backward-compat (1 test)
- Formatters: markdown sections, JSON round-trip, CSV columns, empty snapshots (12 tests)

**Closure criteria:** ✅ script reduced from 561 to 217 lines; zero logic duplication between class and script; 169 tests green; existing `snapshot()` unchanged.

---

## Phase 2.6 — Advanced metrics: percentiles, cost/utility, anomalies (v0.3.0)

**Goal:** close the three metric gaps identified in the traceability matrix: latency percentiles, cost/utility ratio, and anomaly detection. These are the highest-impact metrics not yet tracked.

### 2.6.1 Ring buffer + percentiles

- Ring buffer capped at N=1000 latency samples (new field `latencyMs: number` in `Aggregate`)
- Pure function `percentile(sortedArr, p: number) → number`
- `MetricsSnapshot` gains `latencyP50` and `latencyP95` per group (agent, model, session)
- Zero-cost when no latency data: fields return `null`
- Test: sorted array → p50 = median, p95 = 95th, single element = that value, empty = null

### 2.6.2 Cost/utility ratio

- Track `sessionsStarted` and `sessionsCompleted` (no error) per agent
- Derived: `costPerCompletedSession = totalCost / sessionsCompleted`
- Derived: `abandonmentRate = sessionErrors / sessionsStarted`
- Test: 10 sessions, 8 completed, 2 errored → $5 total → $0.625/session, 20% abandonment

### 2.6.3 Anomaly detection foundation

- New class `AnomalyDetector` (or integrated into `MetricsAggregator`)
- Configurable thresholds: `costSpikeMultiplier` (default 2×), `errorRatePct` (default 10%), `latencyP95Ms` (default 10_000)
- Stateless check per event: returns `AnomalyEvent[]` with `{ type, severity, message, timestamp }`
- Non-blocking: anomalies are collected, not acted upon (future: hook for alerting)
- Test: cost spike → anomaly, error rate above threshold → anomaly, no conditions met → empty

### 2.6.4 Tests

- Percentiles: sorted, unsorted, single, empty, N=1000 cap
- Cost/utility: mixed sessions, all succeeded, all errors, edge (0 sessions)
- Anomalies: spike above threshold, error rate breach, latency breach, no anomaly
- Full suite (including all prior tests) green

**Closure criteria:** 10+ new tests green; `MetricsSnapshot` includes `latencyP50`, `latencyP95`, `sessionsStarted`, `sessionsCompleted`, `costPerCompletedSession`, `abandonmentRate`; `AnomalyDetector` produces typed events; full suite green.

---

## Phase 2.7 — Skill usage tracking (alta prioridad)

**Goal:** track which skills are used, how often, and their cost/error rate.

### 2.7.1 Nuevos tipos de evento

- `SKILL_CALL` / `SKILL_RESULT` en `TraceEventType` (`src/shared/enums.ts`)
- `SkillCallEvent` / `SkillResultEvent` en la unión `TraceEvent` (`trace-events.types.ts`)
- Nuevo campo `skillCalls: number` y `skillErrors: number` en `Aggregate` (`metrics.types.ts`)

### 2.7.2 Handler

- `src/server/handlers/skill-call.handler.ts` — detecta part type `"skill"` y escribe evento al trace
- Registrarlo en `agent-monitor.ts`

### 2.7.3 Agregación (3 pipelines)

- `MetricsAggregator` (server): ingest `skill_call`/`skill_result`
- `EventAggregatorHelper` (CLI): dispatch en `apply()`
- `AggregatorStore` (TUI): dispatch en switch

### 2.7.4 bySkill en snapshot

- `bySkill: Record<string, SkillAggregate>` en `MetricsSnapshot`
- `SkillAggregate = { calls: number; errors: number; avgDurationMs: number }`

### 2.7.5 Formateadores

- Markdown: sección "## By Skill" con tabla
- CSV: columnas skill, calls, errors, avgDurationMs
- JSON: `bySkill` en snapshot

### 2.7.6 Tests

- Handler: escribe trace para skill, ignora no-skill (2+ tests)
- Agregadores: contadores, errores, bySkill (4+ tests)
- Formateadores: secciones, CSV header, JSON round-trip (3 tests)

**Closure criteria:** 9+ new tests green; skill events written to `trace.jsonl`; `bySkill` appears in CLI, export, and TUI outputs; full suite green.

---

## Phase 3 — Tool for OpenCode ❌ REMOVED (2026-06-16)

**Reason:** the project's goal is to generate metrics for **study**, not for the LLM to display them. The TUI plugin (Phase 3.5) already provides real-time display and the CLI provides offline extraction. The tool duplicated both functions for a consumer (LLM) that does not add study value. Its existence also added a `zod` dependency and a `tool` hook that are no longer justified.

Action: removed `src/tools/agent-monitor-stats.{tool,interface,helper}.ts`, `src/test/tools/agent-monitor-stats.test.ts`, and the `zod` dependency. `agent-monitor.ts` no longer exposes `Hooks.tool`. `MetricsAggregator` remains intact for Phase 2.5.

---

## Phase 3.5 — TUI live widget (v0.2.0)

**Goal:** inject a reactive panel into the opencode TUI that shows costs, tokens, and context per agent **in real time**, without opening external windows.

### 3.5.1 Architecture

- Same package, new export `./tui` with a `TuiPluginModule`.
- The source of truth is the `trace.jsonl` already written by the server side of the plugin.
- `JsonlTailer` reads the JSONL incrementally (fs.watch + polling) and emits new lines.
- `AggregatorStore` ingests each event and maintains an aggregated snapshot (totals, byAgent, bySession, byModel).
- Solid components render the snapshot in `sidebar_content` (compact view) and in a fullscreen dialog (`Ctrl+A`).
- KV (`api.kv`) persists the read cursor between TUI restarts.

### 3.5.2 Components

- `src/tui/jsonl-tailer.ts` — incremental JSONL reader with truncation and error handling
- `src/tui/aggregator-store.ts` — event ingestion and aggregated snapshot
- `src/tui/formatters/format-agent-row.ts` — row formatting (cost $0.0000, tokens with locale)
- `src/tui/formatters/format-fullscreen-table.ts` — multiline table with totals
- `src/tui/components/agent-cost-panel.tsx` — Solid sidebar component
- `src/tui/components/fullscreen-stats-dialog.tsx` — Solid dialog component
- `src/tui/agent-monitor-tui.tsx` — entry point: wires tailer, store, slots, keymap, kv

### 3.5.3 Installation

```jsonc
// ~/.config/opencode/tui.json
{
  "$schema": "https://opencode.ai/tui.json",
  "plugin": ["@alvarovfon/opencode-agent-monitor/tui"],
}
```

### 3.5.4 Tests

- [x] `jsonl-tailer.test.ts` — 5 cases (backfill, append, truncate, fs error, partial lines)
- [x] `format-agent-row.test.ts` — 9 cases (0 agents, 1 agent, N agents sorted, locale formatting)
- [x] `format-fullscreen-table.test.ts` — 12 cases (basic view, total row, error indicators)
- [x] `aggregator-store.test.ts` — 4 cases (ingest LLM, replay vs script, stream vs batch, empty)

**Closure criteria:** panel renders in sidebar_content; `Ctrl+A` opens fullscreen dialog; cursor persists between TUI restarts; 30 new tests green; `tsc --noEmit` clean.

### 3.5.5 Per-agent model breakdown + derived metrics (v0.2.0)

**Goal:** enrich each agent row with (a) the models it has used with their individual cost, and (b) derived metrics useful for evaluating efficiency.

**Data decision:**

- Add `byAgentModel: Record<string, Record<string, Aggregate>>` to `MetricsSnapshot`.
- Track in both aggregators (`MetricsAggregator` server + `AggregatorStore` TUI) during `recordLlmCall` / `recordLlmError` with a helper `ensureNestedAggregate`.
- The helper `MetricsAggregatorHelper.mapToNestedRecord` clones the nested structure for immutable snapshots.

**Derived metrics (computed in the panel, no new data):**

- `avg $/call` = `cost / llmCalls` — agent efficiency
- `cache hit rate` = `cacheRead / (input + cacheRead)` — cache usage

**Panel rendering (vertical order by agent, top-down):**

1. Agent name (color `text`)
2. Total cost (color `accent`, indented)
3. Model sub-list (color `secondary` for name, `textMuted` for separator, `text` for cost) — each line `model · N calls · $cost`
4. Sub-separator (color `borderSubtle`)
5. 2×2 grid of raw metrics: `ctx`/`in` on the left, `out`/`call` on the right
6. Derived metrics row: `avg $X.XXXX/call` + `cache X%`
7. Error indicator (color `error`) only if `errors > 0`

**Tests:**

- [x] Server: `MetricsAggregator` covers `byAgentModel` in `llm_call`, `llm_error`, split across agents, split across models of the same agent
- [x] Server: empty snapshot includes `byAgentModel: {}`
- [x] Server: `reset()` clears `byAgentModel`
- [x] TUI: `AggregatorStore` covers split across models, `reset()` clears the field
- [x] TUI: empty snapshot and `reset()` include `byAgentModel`

**Closure criteria:** the `byAgentModel` field appears in the snapshot, models are listed sorted by descending cost, derived metrics are computed correctly even with 0 calls (no division by zero), tests green.

### 3.5.6 Last activity per agent (postponed)

**Goal:** add `lastSeenAt: number` per agent in `byAgent` and display it in the panel as `last: 2m ago`.

**Planned changes:**

- `Aggregate` → `AgentAggregate = Aggregate & { lastSeenAt: number }` or add `lastSeenAt` directly to the `byAgent` map
- `MetricsAggregator` and `AggregatorStore` update `lastSeenAt` on each `llm_call`/`llm_error` with the event's `timestamp`
- The panel formatter renders a relative delta ("5s ago", "2m ago", "1h ago") with color fading from `text` → `textMuted` depending on age
- Test: two events separated by N ms → `lastSeenAt === second timestamp`
- Edge case: first event sets `firstSeenAt === lastSeenAt`

### 3.5.7 Collapsible agent sections (postponed)

**Goal:** allow collapsing each agent block to save vertical space when many agents are active. Pattern already used by the OpenCode MCP plugin.

**Planned changes:**

- `createSignal<Set<string>>(new Set())` of collapsed agents in the `AgentCostPanel` component
- Clicking the agent name (or pressing a specific key) toggles collapse
- When collapsed: only render the name + a dot indicator with total cost in `accent`
- Persist collapse state in `api.kv` to keep preference between restarts
- Consider accessibility: how to navigate with keyboard?

### 3.5.8 Relative cost progress bar (postponed)

**Goal:** quick visualization of which agent is the "most expensive" without reading numbers.

**Planned changes:**

- Calculate `maxCost = max(byAgent[*].cost)` in the panel
- For each agent, render a bar `█`/`░` of N=10 characters with the proportion `cost / maxCost`
- Color: `textMuted` for the empty part, gradient `success` → `warning` → `error` based on proportion
- Useful for visually spotting outliers in a session with many agents

---

## Phase 4 — CLI `bin/agent-monitor` ⏸ DEFERRED (post-persistence)

**Status:** ✅ CLI implemented (stats, errors, export subcommands). Deferred CLI bin packaging for post-persistence.

<details>
<summary>Original spec (2026-06-15)</summary>

### 4.1 Structure

- `bin/agent-monitor` (shebang `#!/usr/bin/env node`)
- `src/cli/cli.ts` — entry point
- Subcommands:
  - `stats [--since 1d|24h|7d|all] [--group-by agent|model|tool] [--session <id>] [--json] [--no-color]`
  - `errors [--since 1d] [--limit N]`
  - `tail [--follow] [--filter type=llm_call]`
  - `export --format csv|json --out <file>`

### 4.2 Data source

- Default: reads `trace.jsonl` from `traceDir` (configurable via `--dir` or env `AGENT_MONITOR_DIR`)
- Alternative `--live`: connects to the in-memory plugin aggregator (not viable cross-process, dev only) → **discarded in v1, the CLI is read-only over JSONL**

### 4.3 Implementation

- No dependencies: `node:readline` for `tail --follow`, manual arg parser (avoid commander/yargs to keep bundle small)
- Tables: `console.table` with ASCII fallback if `--no-color`

### 4.4 package.json

```json
"bin": { "agent-monitor": "bin/agent-monitor" }
```

### 4.5 Tests

- `src/test/cli/stats.test.ts`, `errors.test.ts`, `tail.test.ts`, `export.test.ts`
- Use `node:test` with binary spawn + JSONL fixture

**Closure criteria:** `npx @alvarovfon/opencode-agent-monitor stats` shows table; tests green.

</details>

---

## Phase 5 — Polish (v0.3.0)

**Priority by impact (reviewed 2026-06-16):**

| Order | Item                                                                | Status                | Release |
| ----- | ------------------------------------------------------------------- | --------------------- | ------- |
| 1     | `schemaVersion: 1` on each JSONL event                              | **Included in 0.3.0** | v0.3.0  |
| 2     | Disk growth: rotation/sampling/compaction                           | **Study post-0.3.0**  | v0.4.0+ |
| 3     | `dispose()` of the plugin: final snapshot to `metrics.summary.json` | **Post-stability**    | v0.4.0+ |
| 4     | `report --out report.html`: static dashboard                        | **Post-persistence**  | v0.5.0+ |
| 5     | Documentation: docs page                                            | **In parallel**       | ongoing |

### 5.a `schemaVersion: 1` (v0.3.0)

- [ ] Add `schemaVersion: 1` field to each `writeEvent` in `TraceHelper`
- [ ] Document migration policy in `README.md` (**Schema evolution** section): minor bump = additive, major bump = breaking
- [ ] Test: assert presence of the field on every event type
- [ ] Backfill not needed (optional field in consumers)

### 5.b Disk growth (v0.4.0+, to be designed post-stability)

**Problem:** JSONL append-only grows without limit under heavy usage.

**Options to study:**

- Rotation by size: `trace-YYYY-MM-DD.jsonl` or `trace-NNN.jsonl` when reaching N MB
- Compaction: summarize old events to `trace.summary.jsonl`
- Configurable sampling by `eventType` (user-activatable)
- Gzip compression of rotated files

**Tradeoffs:** sampling loses fidelity; compaction loses raw detail; rotation adds consumer complexity.

### 5.c `dispose()` + summary (v0.4.0+)

- [ ] `dispose()`: flush pending + final snapshot to `metrics.summary.json`
- [ ] Useful as a checkpoint between sessions

### 5.d–5.e HTML report, docs

- Anomaly detection moved to Phase 2.6 (completed)
- `report --out report.html` deferred until persistence model is decided (Phase 6)
- Docs: maintain in parallel with each release

---

## Phase 6 — Formal persistence (SQL) ⏸ under study (post-stability v0.3.0)

**Goal:** evaluate migration from JSONL to a queryable format for data study.

### 6.1 Candidates

| Candidate   | Bundle size | Write perf           | Query power                           | ETL needed                | Maturity |
| ----------- | ----------- | -------------------- | ------------------------------------- | ------------------------- | -------- |
| **SQLite**  | ~3MB        | Good (serial)        | Standard SQL                          | Yes (JSONL→tables)        | ★★★★★    |
| **DuckDB**  | ~30MB       | Very good (columnar) | Analytical SQL + window + percentiles | No (reads JSONL directly) | ★★★      |
| **Parquet** | 0 (format)  | Very good            | None (needs reader)                   | N/A is destination        | ★★★★     |

### 6.2 Hypotheses to validate in the study

- Is the read pattern aggregated queries (GROUP BY, percentiles) or individual event access?
- Expected volume? (affects whether columnar wins)
- Tolerable setup complexity for the user?
- Coexistence with JSONL or full replacement?

### 6.3 Study (spike, no implementation)

- Tradeoff document in `docs/persistence-tradeoffs.md`
- Prototype of each option with a 10k event fixture
- Metrics: write throughput, query latency (3 typical queries), bundle size, setup complexity
- Decision documented before writing production code

---

## Non-goals (explicit)

- **Not** a full APM (does not replace Datadog/NewRelic)
- **Not** sending telemetry to external services
- **Not** mutating OpenCode behavior — only observes
- **Not** supporting multi-tenant / multi-project routing in v0.x
- **Not** including an LLM-callable tool (TUI covers display; script covers extraction)

---

## Project success metrics

- npm downloads (proxy for adoption)
- Open issues / mean time to close (proxy for quality)
- Test coverage (target >80% in handlers and metrics)
- Time from `llm_call` start to trace on disk (target <10ms p95)

---

## Execution order (reviewed 2026-06-17)

1. ✅ **Phase 0** (automation) → release-please, commitlint, husky operational
2. ✅ **Phase 1** (publication) → `1.0.1` on npm
3. ✅ **Phase 2** (aggregator) → tests green, no public API
4. ✅ **Phase 3.5** (TUI widget) → 30 tests, sidebar panel + fullscreen dialog + byAgentModel
5. ✅ **CI/CD consolidation** → consolidated workflows, CI on push to develop, prepublishOnly
6. ✅ **README restructure** → TUI as main feature, reorganized documentation
7. ❌ **Phase 3** (tool LLM) → **removed** (no study value; TUI covers display)
8. ❌ **Phase 4** (CLI) → deferred post-persistence
9. ✅ **Phase 2.5** (extend aggregator) → `byTool`, `errors[]`, `snapshot({ filters })`, formatters, refactor/remove `scripts/metrics.mts`
10. 🔜 **Phase 2.7** (skill tracking) → new event types, handler, bySkill
11. 🔜 **Phase 2.6** (advanced metrics) → percentiles, cost/utility, anomalies
12. 🔜 **Phase 5.a** (`schemaVersion: 1`) → additive field on each event
13. 🔜 **Release 1.1.0** → README overhaul + CI/CD
14. 🔜 **Release 1.2.0** → extended aggregator + advanced metrics + schema
15. ⏸ **Observe stability** → no new features
16. ⏸ **Re-evaluate**: Phase 5.b (disk growth), Phase 6 (persistence), Phase 4 (CLI)
17. ⏸ **Release 1.3.0** → based on post-stability decisions

---

## Open questions / pending decisions (reviewed 2026-06-16)

- ✅ Publish with provenance? Yes (configured with OIDC + GitHub Actions)
- ✅ Should internal-only events (`write_trace_error`) be counted in metrics? No
- ❌ Phase 3 (tool LLM): **removed** — no study value, TUI covers display
- ✅ Phase 4 (CLI): **implemented** — stats, errors, export subcommands (replaces `metrics.mts`). CLI bin packaging deferred post-persistence.
- ⏸ Phase 6 (persistence): SQLite, DuckDB, Parquet, or hybrid? → study pending
- ⏸ Disk growth: rotation, compaction, sampling? → design post-stability 0.3.0
- ⏸ Add `bin/` as entry point? → re-evaluate with Phase 4 post-persistence
