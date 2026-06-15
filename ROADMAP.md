# ROADMAP.md — `@alvarovfon/opencode-agent-monitor`

> Documento vivo. Define fases, criterios de aceptación y alcance. Se actualiza al cerrar cada fase.

## Visión

Plugin OpenCode que **traza** eventos a JSONL y, en su segunda fase, **agrega y expone métricas** vía tool (consumible por el LLM) y CLI (consumible por humanos), con foco en **cost, tokens, latencia y error rate** por `agent` / `model` / `tool`.

## Estado actual (snapshot al 2026-06-15)

- ✅ Trazado de eventos: `session_created`, `session_error`, `llm_call`, `llm_error`, `agent_delegation`, `tool_call`, `write_trace_error`
- ✅ Doble salida (`trace.jsonl` + `trace.errors.jsonl`) con manejo defensivo de I/O
- ✅ 42 tests, 12 suites, todos verdes
- ✅ Tipos del SDK (`@opencode-ai/sdk`) integrados
- ❌ No publicado en npm
- ❌ Sin LICENSE, CHANGELOG, CI
- ❌ `ToolCallHandler` uncommitted y sin test
- ❌ Sin agregación de métricas
- ❌ Sin tool/CLI de exposición

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

## Fase 2 — Capa de agregación de métricas (v0.2.0)

**Objetivo:** tener un `MetricsAggregator` que consume los mismos eventos que `EventHandler` y mantiene un snapshot en memoria, sin tocar el flujo de tracing actual.

### 2.1 Diseño

- Nueva clase `MetricsAggregator` en `src/metrics/metrics.aggregator.ts`
- Recibe los mismos eventos (`message.updated`, `message.part.updated`, etc.) por un segundo canal
- Estado interno:
  ```ts
  {
    totals: { llmCalls, llmErrors, toolCalls, toolErrors, sessionsCreated },
    tokens: { input, output, reasoning, cacheRead },
    cost: number,
    durationsMs: { llm: number[], tool: number[] },
    byAgent:   Map<string, { llmCalls, cost, tokens: {...}, errors }>,
    byModel:   Map<string, { llmCalls, cost, tokens: {...}, errors }>,
    byTool:    Map<string, { calls, errors, durationMs: number[] }>,
    bySession: Map<string, { llmCalls, cost, tokens: {...} }>,
    firstSeenAt: number,
    lastSeenAt: number,
  }
  ```
- Métodos:
  - `ingest(event)` — enrutado por tipo
  - `snapshot(opts?: { since?: number; sessionID?: string; groupBy?: 'agent' | 'model' | 'tool' })` — devuelve objeto JSON
  - `reset()` — para tests

### 2.2 Cálculo de percentiles

- Mantener arrays de duración capped a N=1000 muestras (ring buffer) para p50/p95 sin memoria ilimitada
- Función pura `percentile(arr, p)` testeable

### 2.3 Tests

- `src/test/metrics/metrics.aggregator.test.ts`:
  - ingest de `llm_call` actualiza totales, tokens, cost, byAgent, byModel
  - ingest de `llm_error` incrementa error count
  - ingest de `tool_call` (completed) y (error) actualiza byTool
  - ingest de `session_created` actualiza firstSeenAt, lastSeenAt
  - `snapshot()` filtra por `sessionID`
  - `snapshot()` agrupa correctamente
  - p50/p95 calculados correctamente
  - `reset()` limpia estado

### 2.4 Integración con el plugin

- `agent-monitor.ts`: instanciar `MetricsAggregator` y pasarle cada evento en paralelo al `EventHandler`
- Sin cambios en handlers ni en `TraceHelper` — aditivo

**Criterio de cierre:** tests verdes; el plugin sigue escribiendo JSONL igual que antes; existe método público para obtener snapshot (aunque aún no expuesto al usuario).

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
4. **Fase 3** (tool) → demo end-to-end con LLM
5. **Fase 4** (CLI) → binario funcional
6. Release conjunto: **`0.2.0`** con tool + CLI + métricas (auto via release-please)
7. **Fase 5** (polish) → `0.3.0`

---

## Open questions / decisiones pendientes

- ¿Añadir `bin/` como symlink en `files`? Sí.
- ¿Publicar con provenance? Sí (`npm publish --provenance` requiere repo público + GitHub Actions OIDC).
- ¿Soportar `--watch` en CLI `tail`? Sí.
- ¿Internal-only events (`write_trace_error`) deben contarse en métricas? **No** — son señales de salud del plugin, no del workload.
