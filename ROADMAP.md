# ROADMAP.md — `@alvarovfon/opencode-agent-monitor`

> Documento vivo. Define fases, criterios de aceptación y alcance. Se actualiza al cerrar cada fase.

## Visión

Plugin OpenCode que **traza** eventos a JSONL y, en su segunda fase, **agrega y expone métricas** vía tool (consumible por el LLM) y CLI (consumible por humanos), con foco en **cost, tokens, latencia y error rate** por `agent` / `model` / `tool`.

## Estado actual (snapshot al 2026-06-15)

- ✅ Trazado de eventos: `session_created`, `session_error`, `llm_call`, `llm_error`, `agent_delegation`, `tool_call`, `write_trace_error`
- ✅ Doble salida (`trace.jsonl` + `trace.errors.jsonl`) con manejo defensivo de I/O
- ✅ Tipos del SDK (`@opencode-ai/sdk`) integrados
- ✅ Publicado en npm: `@alvarovfon/opencode-agent-monitor@0.1.1`
- ✅ LICENSE (MIT), CHANGELOG gestionado por release-please
- ✅ `ToolCallHandler` con test (6 casos)
- ✅ Conventional commits + commitlint + husky
- ✅ release-please + GitHub Actions (release + publish con OIDC)
- ✅ Prettier + CI workflow (lint, format:check, test) en PRs a `main`/`develop`
- ✅ Git Flow con `develop` como default branch
- ✅ `MetricsAggregator` completo (Phase 2)
- ✅ TUI plugin real-time: sidebar panel + fullscreen dialog con cost/tokens por agente (Phase 3.5)
- ✅ `scripts/metrics.mts` — script batch para métricas JSON/markdown
- ❌ Sin tool LLM-callable / CLI (Phases 3 y 4)

---

## Fase 0 — Automation (release-please + commitlint + husky)

**Objetivo:** versionado y changelog automáticos desde el primer `feat:`. Cero intervención manual para releases.

### 0.1 Conventional commits enforcement

- [ ] `commitlint.config.cjs` con `@commitlint/config-conventional` + tipos permitidos
- [ ] Hook `commit-msg` en `.husky/` que valida cada commit
- [ ] Script `prepare: "husky"` en `package.json`

### 0.2 release-please config

- [ ] `release-please-config.json` con `releaseType: "node"` y secciones por tipo de commit
- [ ] `.release-please-manifest.json` con versión actual (`"0.1.1"`)
- [ ] `bumpMinorPreMajor: true` para que `feat:` bumpee minor incluso antes de 1.0
- [ ] `bumpPatchForMinorPreMajor: false` para no bumpear patch por feat pre-1.0 (mantiene semver estricto)

### 0.3 GitHub workflows

- [ ] `.github/workflows/release-please.yml` — abre/actualiza Release PR en cada push a `main`
- [ ] `.github/workflows/publish.yml` — disparado por `release: published`, ejecuta `npm ci && npm run lint && npm test && npm publish --provenance`
- [ ] Ambos con `id-token: write` para OIDC trusted publishing

### 0.4 CHANGELOG gestionado

- [ ] `CHANGELOG.md` queda como skeleton; release-please lo regenera en cada Release PR
- [ ] Eliminado del versionado manual de versiones

### 0.5 Trusted publishing (npm)

- [ ] `publishConfig.provenance: true` en `package.json`
- [ ] Configurar Trusted Publisher en https://www.npmjs.com/package/@alvarovfon/opencode-agent-monitor → Settings → Trusted Publishers (workflow `publish.yml`)

**Criterio de cierre:** push a `main` con commit `feat:` abre un Release PR; al mergearlo, se crea el tag, el GitHub Release, y se publica a npm con provenance.

---

## Fase 1 — Estabilización y primer publish (v0.1.1)

**Objetivo:** paquete publicable, código limpio, trazabilidad mínima garantizada.

### 1.1 Commit trabajo pendiente

- [ ] `git add` cambios en working tree
- [ ] Commit con mensaje: `feat: track tool calls and harden llm_call completion check`

### 1.2 Test para `ToolCallHandler`

- [ ] Crear `src/test/handlers/tool-call.handler.test.ts`
- [ ] Casos:
  - escribe trace cuando `state.status === "completed"` con `durationMs` correcto
  - escribe trace cuando `state.status === "error"` e incluye `error`
  - ignora estados `pending` y `running`
  - `durationMs = null` si falta `state.time.end`
  - `agent` se lee del map; fallback a `unknown`

### 1.3 Documentación mínima

- [ ] Crear `LICENSE` (MIT) — texto completo
- [ ] Crear `CHANGELOG.md` siguiendo Keep a Changelog
  - `## [0.1.1] - YYYY-MM-DD`
  - `### Added`: tool call tracking
  - `### Fixed`: discard `llm_call` events sin `time.completed`
- [ ] `README.md`: añadir sección **Limitations** (lo que aún NO hace: métricas agregadas, tool/CLI)

### 1.4 Scripts de package.json

- [ ] Añadir `format` (`prettier --write .`)
- [ ] Añadir `lint` (`tsc --noEmit` como mínimo — sin ESLint por ahora)
- [ ] Añadir `prepublishOnly`: `npm run lint && npm test`
- [ ] `version` en `package.json` → `0.1.1`

### 1.5 `files` y exports

- [ ] Confirmar `files: ["src/", "package.json", "tsconfig.json", "LICENSE", "CHANGELOG.md", "README.md"]`
- [ ] Eliminar export `./trace-helper` (innecesario para usuarios externos; rompe encapsulación)

### 1.6 Limpieza

- [ ] Quitar `UNHANDLED_EVENT` de `enums.ts` (sin uso)
- [ ] Revisar `MessagePartUpdatedProps` y `LaxAssistantMessage`: documentar en código por qué son laxos (mensajes de error llegan sin `tokens`)

### 1.7 Publicación

- [ ] `npm login` (manual del usuario)
- [ ] `npm run prepublishOnly` (verificación local)
- [ ] `npm publish --access public` (manual, tag git `v0.1.1` antes)

**Criterio de cierre:** `npm view @alvarovfon/opencode-agent-monitor` muestra `0.1.1`.

---

## Fase 2 — Capa de agregación de métricas (v0.2.0) — **in progress**

**Objetivo:** tener un `MetricsAggregator` que consume los mismos eventos que `EventHandler` y mantiene un snapshot en memoria, sin tocar el flujo de tracing actual.

### 2.1 Diseño

- Nueva clase `MetricsAggregator` en `src/metrics/metrics.aggregator.ts`
- Recibe los mismos eventos OpenCode (`message.updated`, `message.part.updated`, `session.created`) en paralelo a `EventHandler`
- Estado interno:
  ```ts
  {
    totals: { llmCalls, llmErrors, toolCalls, toolErrors, sessionsCreated,
              tokens: { input, output, reasoning, cacheRead }, cost },
    bySession: Map<string, Aggregate>,
    byAgent:   Map<string, Aggregate>,
    byModel:   Map<string, Aggregate>,
    firstSeenAt: number,
    lastSeenAt: number,
  }
  ```
- Métodos:
  - `ingest(event)` — switch por tipo de evento
  - `snapshot()` — devuelve objeto JSON (sin filtros en v0.2)
  - `reset()` — para tests

### 2.2 Percentiles — pospuesto a fase futura

- Diferido: primero queremos saber qué consultas harás realmente sobre los datos (top N sesiones más caras, hotspot agent×model, etc.) y luego decidir si p50/p95 son la métrica correcta o necesitamos otra cosa.
- Cuando se añada: ring buffer capped a N=1000, función pura `percentile(arr, p)`.

### 2.3 Tests

- `src/test/metrics/metrics.aggregator.test.ts` (8 casos):
  - `llm_call` actualiza totales, byAgent, byModel, bySession
  - 2 agentes distintos → 2 keys, totales = suma
  - `llm_error` incrementa counter sin tocar tokens/cost
  - `tool_call` (completed) incrementa toolCalls
  - `tool_call` (error) incrementa toolErrors
  - `session_created` actualiza sessionsCreated + window
  - `snapshot()` en estado vacío
  - `reset()` limpia todo

### 2.4 Integración con el plugin

- `agent-monitor.ts`: instanciar `MetricsAggregator` y pasarle cada evento en paralelo al `EventHandler` (1 línea)
- Sin cambios en handlers ni en `TraceHelper` — aditivo

**Criterio de cierre:** 8 tests verdes + suite completa sigue verde; el plugin sigue escribiendo JSONL igual que antes; `MetricsAggregator.snapshot()` público pero aún no expuesto al usuario.

---

## Fase 3 — Tool para OpenCode (v0.2.0)

**Objetivo:** exponer las métricas como tool que el LLM puede invocar mid-conversation.

### 3.1 Implementación

- Usar `tool()` de `@opencode-ai/plugin` (`@opencode-ai/plugin/tool`)
- Schema `zod`:
  ```ts
  {
    since: z.enum(["1h", "24h", "7d", "all"]).default("24h"),
    groupBy: z.enum(["agent", "model", "tool"]).optional(),
    sessionID: z.string().optional(),
    format: z.enum(["markdown", "json"]).default("markdown"),
  }
  ```
- `execute()`: lee `MetricsAggregator.snapshot({ since, groupBy, sessionID })` y formatea
- Devuelve `ToolResult` markdown por defecto (tabla ASCII), JSON bajo `format: "json"`

### 3.2 Registro

- En `agent-monitor.ts` añadir a `Hooks.tool`:
  ```ts
  tool: {
    agent_monitor_stats: tool({...}),
  }
  ```
- Naming: `agent_monitor_stats` (snake_case sigue convención SDK)

### 3.3 Tests

- `src/test/tools/agent-monitor-stats.test.ts`:
  - devuelve tabla markdown con totales
  - filtra por `since`
  - agrupa por agent
  - agrupa por tool
  - formato JSON estructurado
  - mensaje vacío cuando no hay datos

**Criterio de cierre:** el usuario puede pedirle al agente "muéstrame las métricas" y obtiene una tabla; los tests pasan.

---

## Fase 3.5 — TUI live widget (v0.3.0)

**Objetivo:** inyectar un panel reactivo en el TUI de opencode que muestra costes, tokens y contexto por agente **en tiempo real**, sin abrir ventanas externas.

### 3.5.1 Arquitectura

- Mismo paquete, nuevo export `./tui` con un `TuiPluginModule`.
- La fuente de verdad es el `trace.jsonl` que ya escribe la parte server del plugin.
- `JsonlTailer` lee el JSONL incrementalmente (fs.watch + polling) y emite líneas nuevas.
- `AggregatorStore` ingiere cada evento y mantiene un snapshot agregado (totals, byAgent, bySession, byModel).
- Componentes Solid renderizan el snapshot en `sidebar_content` (vista compacta) y en un diálogo fullscreen (`Ctrl+A`).
- KV (`api.kv`) persiste el cursor de lectura entre reinicios del TUI.

### 3.5.2 Componentes

- `src/tui/jsonl-tailer.ts` — lector incremental de JSONL con manejo de truncado y errores
- `src/tui/aggregator-store.ts` — ingesta de eventos y snapshot agregado
- `src/tui/formatters/format-agent-row.ts` — formato de fila (cost $0.0000, tokens con locale)
- `src/tui/formatters/format-fullscreen-table.ts` — tabla multilínea con totales
- `src/tui/components/agent-cost-panel.tsx` — Solid component sidebar
- `src/tui/components/fullscreen-stats-dialog.tsx` — Solid component diálogo
- `src/tui/agent-monitor-tui.tsx` — entry point: wires cola, store, slots, keymap, kv

### 3.5.3 Instalación

```jsonc
// ~/.config/opencode/tui.json
{
  "$schema": "https://opencode.ai/tui.json",
  "plugin": ["@alvarovfon/opencode-agent-monitor/tui"],
}
```

### 3.5.4 Tests

- [x] `jsonl-tailer.test.ts` — 5 casos (backfill, append, truncate, fs error, partial lines)
- [x] `format-agent-row.test.ts` — 9 casos (0 agents, 1 agent, N agents sorted, locale formatting)
- [x] `format-fullscreen-table.test.ts` — 12 casos (basic view, total row, error indicators)
- [x] `aggregator-store.test.ts` — 4 casos (ingest LLM, replay vs script, stream vs batch, empty)

**Criterio de cierre:** panel renderiza en sidebar_content; `Ctrl+A` abre diálogo fullscreen; cursor persiste entre reinicios del TUI; 30 tests nuevos verdes; `tsc --noEmit` limpio.

---

## Fase 4 — CLI (v0.2.0)

**Objetivo:** binario ejecutable para humanos, sin pasar por el agent loop.

### 4.1 Estructura

- `bin/agent-monitor` (shebang `#!/usr/bin/env node`)
- `src/cli/cli.ts` — entry point
- Subcomandos:
  - `stats [--since 1d|24h|7d|all] [--group-by agent|model|tool] [--session <id>] [--json] [--no-color]`
  - `errors [--since 1d] [--limit N]`
  - `tail [--follow] [--filter type=llm_call]`
  - `export --format csv|json --out <file>`

### 4.2 Source de datos

- Por defecto: lee `trace.jsonl` desde `traceDir` (configurable por `--dir` o env `AGENT_MONITOR_DIR`)
- Alternativa `--live`: se conecta al aggregator del plugin en memoria (no viable cross-process, sólo en modo dev) → **descartado en v1, el CLI es read-only sobre JSONL**

### 4.3 Implementación

- Sin dependencias: `node:readline` para `tail --follow`, parser manual para args (evitar commander/yargs para mantener bundle pequeño)
- Tablas: `console.table` con fallback a ASCII si `--no-color`

### 4.4 package.json

```json
"bin": { "agent-monitor": "bin/agent-monitor" }
```

### 4.5 Tests

- `src/test/cli/stats.test.ts`, `errors.test.ts`, `tail.test.ts`, `export.test.ts`
- Usar `node:test` con spawn del binario + fixture JSONL

**Criterio de cierre:** `npx @alvarovfon/opencode-agent-monitor stats` muestra tabla; tests verdes.

---

## Fase 5 — Polish (v0.3.0)

- [ ] `schemaVersion: 1` en cada evento JSONL (campo nuevo, no rompe consumidores)
- [ ] Sampling configurable (`sampleRate: 0.1` para LLM calls de alto volumen)
- [ ] Buffer en memoria con flush periódico (batch writes) para reducir syscalls
- [ ] `dispose()` del plugin: snapshot final a `metrics.summary.json`
- [ ] Detección de anomalías: spike de cost, latencia p95 > umbral, error rate > N%
- [ ] `report --out report.html`: dashboard estático (HTML + SVG inline, sin bundler)
- [ ] Documentación: página de docs (vitepress? docusaurus? o README largo), ejemplos de uso

---

## No-objetivos (explícitos)

- **No** es un APM completo (no reemplaza Datadog/NewRelic)
- **No** envía telemetría a servicios externos
- **No** muta el comportamiento de OpenCode — sólo observa
- **No** persiste estado entre reinicios del plugin en v0.2 (la CLI lee JSONL directamente)
- **No** soporta multi-tenant / multi-project routing en v0.x

---

## Métricas de éxito del proyecto

- Downloads npm (proxy de adopción)
- Issues abiertos / tiempo medio de cierre (proxy de calidad)
- Coverage de tests (objetivo >80% en handlers y metrics)
- Tiempo desde `llm_call` start hasta trace en disco (objetivo <10ms p95)

---

## Orden de ejecución

1. **Fase 0** (automation) → release-please, commitlint, husky operativos
2. **Fase 1** (publicación) → `0.1.1` en npm (manual, antes de tener CI)
3. **Fase 2** (aggregator) → tests verdes, sin API pública
4. **Fase 3.5** (TUI widget) → ✅ completado (30 tests, panel sidebar + diálogo fullscreen)
5. **Fase 3** (tool) → demo end-to-end con LLM
6. **Fase 4** (CLI) → binario funcional
7. Release conjunto: **`0.3.0`** con tool + CLI + TUI widget (auto via release-please)
8. **Fase 5** (polish) → `0.4.0`

---

## Open questions / decisiones pendientes

- ¿Añadir `bin/` como symlink en `files`? Sí.
- ¿Publicar con provenance? Sí (`npm publish --provenance` requiere repo público + GitHub Actions OIDC).
- ¿Soportar `--watch` en CLI `tail`? Sí.
- ¿Internal-only events (`write_trace_error`) deben contarse en métricas? **No** — son señales de salud del plugin, no del workload.
