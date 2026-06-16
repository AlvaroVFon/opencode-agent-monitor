# ROADMAP.md — `@alvarovfon/opencode-agent-monitor`

> Documento vivo. Define fases, criterios de aceptación y alcance. Se actualiza al cerrar cada fase.

## Visión

Plugin OpenCode que **traza** eventos a JSONL y, en su segunda fase, **agrega y expone métricas** vía tool (consumible por el LLM) y CLI (consumible por humanos), con foco en **cost, tokens, latencia y error rate** por `agent` / `model` / `tool`.

## Estado actual (snapshot al 2026-06-16)

## Estado actual (snapshot al 2026-06-16)

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
  <<<<<<< HEAD
- ✅ `MetricsAggregator` completo (Fase 2): `bySession` / `byAgent` / `byModel` / `byAgentModel`
- ✅ TUI plugin real-time (Fase 3.5): sidebar panel + fullscreen dialog + `byAgentModel` + métricas derivadas (30 tests)
- ✅ `scripts/metrics.mts` — script batch para métricas JSON/markdown
- ✅ Fases 0 y 1 completas (release-please + primera publicación)
- ❌ `MetricsAggregator` no tiene `byTool`, `errors[]`, ni `snapshot({ filters })` (Fase 2.5 pendiente)
- ❌ Sin `schemaVersion` en eventos JSONL (5.a pendiente)
- ❌ Tool LLM-callable eliminado del scope (no aporta al estudio de datos; TUI ya cubre display)
- ⏸ CLI diferido post-persistencia (script `metrics.mts` cubre extracción humana actual)
- # ⏸ Persistencia formal (SQL) pendiente de estudio de tradeoffs
- ✅ `MetricsAggregator` completado con 8 tests (Phase 2)
- ✅ `agent_monitor_stats` tool expuesta via `Hooks.tool` (Phase 3)
- ❌ Sin CLI de exposición (Phase 4)
  > > > > > > > develop

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

## Fase 2 — Capa de agregación de métricas (v0.2.0) — ✅ **completado (2026-06-16)**

**Objetivo:** tener un `MetricsAggregator` que consume los mismos eventos que `EventHandler` y mantiene un snapshot en memoria, sin tocar el flujo de tracing actual.

### 2.1 Diseño

- ✅ Nueva clase `MetricsAggregator` en `src/metrics/metrics.aggregator.ts`
- ✅ Recibe los mismos eventos OpenCode (`message.updated`, `message.part.updated`, `session.created`) en paralelo a `EventHandler`
- ✅ Estado interno con totals, bySession, byAgent, byModel + window
- ✅ Métodos `ingest()`, `snapshot()`, `reset()`

### 2.2 Percentiles — pospuesto a fase futura

- Diferido: primero queremos saber qué consultas harás realmente sobre los datos (top N sesiones más caras, hotspot agent×model, etc.) y luego decidir si p50/p95 son la métrica correcta o necesitamos otra cosa.
- Cuando se añada: ring buffer capped a N=1000, función pura `percentile(arr, p)`.

### 2.3 Tests

- ✅ `src/test/metrics/metrics.aggregator.test.ts` (8 casos)

### 2.4 Integración con el plugin

- ✅ `agent-monitor.ts`: `MetricsAggregator` instanciado y cada evento se pasa a `metricsAggregator.ingest(event)` en paralelo al `EventHandler`
- ✅ Sin cambios en handlers ni en `TraceHelper` — aditivo

**Criterio de cierre:** ✅ 8 tests verdes + suite completa (62 tests) sigue verde; el plugin sigue escribiendo JSONL igual que antes; `MetricsAggregator.snapshot()` expuesto via tool `agent_monitor_stats`.

---

<<<<<<< HEAD

## Fase 2.5 — Extender `MetricsAggregator` con filtros, `byTool`, errores y formatters (v0.3.0)

**Objetivo:** absorber la lógica de agregación duplicada de `scripts/metrics.mts` dentro de `MetricsAggregator` para que el script, el TUI server-side y cualquier futuro consumer compartan una única fuente de verdad.

### 2.5.1 Gap actual

| Funcionalidad                                            | `MetricsAggregator` (clase) | `scripts/metrics.mts`       |
| -------------------------------------------------------- | --------------------------- | --------------------------- |
| `byAgent` / `bySession` / `byModel`                      | ✅                          | ❌ (solo byAgent/bySession) |
| `byAgentModel`                                           | ✅                          | ❌                          |
| `byTool: Map<string, ToolAggregate>`                     | ❌                          | ✅                          |
| `errors: ErrorEntry[]` con detalle                       | ❌ (solo contadores)        | ✅                          |
| `snapshot({ filters })` — since, groupBy, sessionID, top | ❌ (snapshot sin params)    | ❌ (script recibe --dir)    |
| formatters (markdown, json, csv)                         | ❌                          | ✅ (inline en script)       |

### 2.5.2 Añadidos a la clase

- Estado nuevo:
  ```ts
  byTool: Map<string, ToolAggregate>      // tool → calls, errors, duration
  errors: ErrorEntry[]                     // capped N=1000, { sessionID, type, message, timestamp }
  ```
- `snapshot({ since?, groupBy?, sessionID?, top?, format? })` con backward-compat (sin args = comportamiento actual)
- Formatters en `src/metrics/formatters/{markdown,json,csv}.ts` (funciones puras: `MetricSnapshot → string`)
- `getErrors(sessionID?)` helper — acceso a la lista de errores

### 2.5.3 Refactor de scripts/metrics.mts

- Eliminar lógica de agregación duplicada (líneas 53-320)
- Script pasa a ser: replay JSONL → `agg.ingest(event)` → `console.log(formatSnapshot(snap, opts))`
- ≤ 30 líneas total

### 2.5.4 Tests

- `byTool`: ingest `tool_call` completed/error → `byTool` keys y agregados
- `errors[]`: `session_error` / `llm_error` / `tool_call` error → entries con detalle
- `errors[]` cap: más de 1000 entries → solo las últimas 1000
- `snapshot({ since })`: filtra eventos fuera de ventana
- `snapshot({ groupBy })`: agrupa por agent/model/tool/session
- `snapshot({ sessionID })`: filtra por sesión
- `snapshot({ top })`: ranking top-N (por cost/tokens/calls)
- `snapshot()` sin args → comportamiento actual (backward-compat)
- Formatters: markdown con tabla, json con estructura, csv con headers
- Formatters: snapshot vacío → output adecuado
- Suite completa (incluyendo 30 tests TUI) verde

**Criterio de cierre:** script reducido a ≤30 líneas; cero duplicación de lógica entre clase y script; mismos tests TUI verdes; `snapshot()` existente sin breaking change.

---

## Fase 3 — Tool para OpenCode ~~(v0.2.0)~~ ❌ ELIMINADA

**Motivo:** el objetivo del proyecto es generar métricas de **estudio**, no que el LLM las muestre. El TUI plugin (Fase 3.5) ya da display en tiempo real y `scripts/metrics.mts` da extracción offline. El tool duplicaba ambas funciones para un consumidor (LLM) que no aporta valor de estudio.

El contenido original se preserva abajo como referencia histórica.

<details>
<summary>Spec original (2026-06-15)</summary>

### 3.1 Implementación

=======

## Fase 3 — Tool para OpenCode (v0.2.0) — ✅ **completado (2026-06-16)**

> > > > > > > develop

**Objetivo:** exponer las métricas como tool que el LLM puede invocar mid-conversation.

### 3.1 Implementación

- ✅ `src/tools/agent-monitor-stats.interface.ts` — tipos `StatsToolArgs`, `StatsFormat`, `FilteredSnapshot`
- ✅ `src/tools/agent-monitor-stats.helper.ts` — clase `StatsFormatter` con formateo markdown/JSON + filtrado por `sessionID`
- ✅ `src/tools/agent-monitor-stats.tool.ts` — factory `createAgentMonitorStatsTool()` que construye `ToolDefinition` con schema zod (`since`, `groupBy`, `sessionID`, `format`)
- ✅ Markdown por defecto (tabla ASCII), JSON bajo `format: "json"`
- ✅ Acepta `groupBy: "agent" | "model" | "tool"` (tool muestra solo totales, sin breakdown por no estar implementado en aggregator)

### 3.2 Registro

- ✅ `agent-monitor.ts` registra `agent_monitor_stats` en `Hooks.tool`

### 3.3 Tests

- ✅ `src/test/tools/agent-monitor-stats.test.ts` (6 casos):
  - tabla markdown con totales
  - agrupa por agent
  - agrupa por model
  - formato JSON estructurado
  - filtro por sessionID
  - sin datos

**Criterio de cierre:** ✅ el usuario puede pedirle al agente "muéstrame las métricas" y obtiene una tabla; 62 tests pasan.

</details>

---

## Fase 3.5 — TUI live widget (v0.2.0)

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

### 3.5.5 Modelo por agente + métricas derivadas (v0.2.0)

**Objetivo:** enriquecer cada fila de agente con (a) los modelos que ha usado con su coste individual, y (b) métricas derivadas útiles para evaluar eficiencia.

**Decisión de datos:**

- Añadir `byAgentModel: Record<string, Record<string, Aggregate>>` a `MetricsSnapshot`.
- Trackear en ambos agregadores (`MetricsAggregator` server + `AggregatorStore` TUI) durante `recordLlmCall` / `recordLlmError` con un helper `ensureNestedAggregate`.
- El helper `MetricsAggregatorHelper.mapToNestedRecord` clona la estructura anidada para snapshots inmutables.

**Métricas derivadas (calculadas en el panel, sin nueva data):**

- `avg $/call` = `cost / llmCalls` — eficiencia por agente
- `cache hit rate` = `cacheRead / (input + cacheRead)` — uso del cache

**Render del panel (orden vertical por agente, top-down):**

1. Nombre del agente (color `text`)
2. Coste total (color `accent`, indentado)
3. Sub-lista de modelos (color `secondary` para el nombre, `textMuted` para separador, `text` para coste) — cada línea `model · N calls · $cost`
4. Sub-separador (color `borderSubtle`)
5. Grid 2×2 de métricas crudas: `ctx`/`in` a la izquierda, `out`/`call` a la derecha
6. Fila de métricas derivadas: `avg $X.XXXX/call` + `cache X%`
7. Indicador de errores (color `error`) solo si `errors > 0`

**Tests:**

- [x] Server: `MetricsAggregator` cubre `byAgentModel` en `llm_call`, `llm_error`, split entre agentes, split entre modelos del mismo agente
- [x] Server: snapshot vacío incluye `byAgentModel: {}`
- [x] Server: `reset()` limpia `byAgentModel`
- [x] TUI: `AggregatorStore` cubre split entre modelos, `reset()` limpia el campo
- [x] TUI: snapshot vacío y `reset()` incluyen `byAgentModel`

**Criterio de cierre:** el campo `byAgentModel` aparece en el snapshot, los modelos se listan ordenados por coste descendente, las métricas derivadas se computan correctamente incluso con 0 calls (no division by zero), tests verdes.

### 3.5.6 Última actividad por agente (pospuesto)

**Objetivo:** añadir `lastSeenAt: number` por agente en `byAgent` y mostrarlo en el panel como `last: 2m ago`.

**Cambios previstos:**

- `Aggregate` → `AgentAggregate = Aggregate & { lastSeenAt: number }` o añadir `lastSeenAt` directamente al `byAgent` map
- `MetricsAggregator` y `AggregatorStore` actualizan `lastSeenAt` en cada `llm_call`/`llm_error` con el `timestamp` del evento
- El formateador del panel renderiza un delta relativo ("5s ago", "2m ago", "1h ago") con el color degradando de `text` → `textMuted` según la edad
- Test: dos eventos separados por N ms → `lastSeenAt === segundo timestamp`
- Edge case: el primer evento fija `firstSeenAt === lastSeenAt`

### 3.5.7 Secciones colapsables por agente (pospuesto)

**Objetivo:** permitir plegar cada bloque de agente para ahorrar espacio vertical cuando hay muchos agentes activos. Patrón ya en uso por el plugin MCP de OpenCode.

**Cambios previstos:**

- `createSignal<Set<string>>(new Set())` de agentes colapsados en el componente `AgentCostPanel`
- Al hacer click en el nombre del agente (o presionar una tecla específica) se togglea
- Cuando está colapsado: solo se renderiza el nombre + un dot indicator con coste total en `accent`
- Persistir el estado de colapso en `api.kv` para mantener preferencia entre reinicios
- Considerar accesibilidad: ¿cómo se navega con teclado?

### 3.5.8 Barrita de progreso de coste relativo (pospuesto)

**Objetivo:** visualización rápida de qué agente es el "más caro" sin leer números.

**Cambios previstos:**

- Calcular `maxCost = max(byAgent[*].cost)` en el panel
- Por cada agente, renderizar una barrita `█`/`░` de N=10 caracteres con la proporción `cost / maxCost`
- Color: `textMuted` para la parte vacía, gradiente `success` → `warning` → `error` según la proporción
- Útil para detectar visualmente outliers en una sesión con muchos agentes

---

## Fase 4 — CLI `bin/agent-monitor` ⏸ DIFERIDA (post-persistencia)

**Estado:** diferida hasta que se decida el modelo de persistencia (Fase 6). El script `npm run metrics` cubre extracción humana actual. Un CLI sobre JSONL tendría más valor sobre DuckDB/SQLite una vez implementado.

<details>
<summary>Spec original (2026-06-15)</summary>

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

</details>

---

## Fase 5 — Polish (v0.3.0)

**Prioridad por impacto (revisada 2026-06-16):**

| Orden | Item                                                                          | Estado                 | Release  |
| ----- | ----------------------------------------------------------------------------- | ---------------------- | -------- |
| 1     | `schemaVersion: 1` en cada evento JSONL                                       | **Incluido en 0.3.0**  | v0.3.0   |
| 2     | Crecimiento de disco: rotación/sampling/compactación                          | **Estudio post-0.3.0** | v0.4.0+  |
| 3     | `dispose()` del plugin: snapshot final a `metrics.summary.json`               | **Post-estabilidad**   | v0.4.0+  |
| 4     | Detección de anomalías: spike de cost, latencia p95 > umbral, error rate > N% | **Post-persistencia**  | v0.5.0+  |
| 5     | `report --out report.html`: dashboard estático                                | **Post-persistencia**  | v0.5.0+  |
| 6     | Documentación: página de docs                                                 | **En paralelo**        | continuo |

### 5.a `schemaVersion: 1` (v0.3.0)

- [ ] Añadir campo `schemaVersion: 1` en cada `writeEvent` del `TraceHelper`
- [ ] Documentar política de migración en `README.md` (sección **Schema evolution**): minor bump = aditivo, major bump = breaking
- [ ] Test: assert presencia del campo en cada tipo de evento
- [ ] Backfill no necesario (campo opcional en consumers)

### 5.b Crecimiento de disco (v0.4.0+, a diseñar post-estabilidad)

**Problema:** JSONL append-only crece sin límite bajo uso intensivo.

**Opciones a estudiar:**

- Rotación por tamaño: `trace-YYYY-MM-DD.jsonl` o `trace-NNN.jsonl` al alcanzar N MB
- Compaction: summarizar eventos antiguos a `trace.summary.jsonl`
- Sampling configurable por `eventType` (activable por usuario)
- Compresión gzip de ficheros rotados

**Tradeoffs:** sampling pierde fidelidad; compaction pierde detalle raw; rotación añade complejidad de consumer.

### 5.c `dispose()` + summary (v0.4.0+)

- [ ] `dispose()`: flush pendientes + snapshot final a `metrics.summary.json`
- [ ] Útil como checkpoint entre sesiones

### 5.d–5.f Anomalías, report HTML, docs

- Diferidos hasta tener modelo de persistencia decidido (Fase 6)
- Docs: mantener en paralelo con cada release

---

## Fase 6 — Persistencia formal (SQL) ⏸ a estudiar (post-estabilidad v0.3.0)

**Objetivo:** evaluar migración de JSONL a un formato consultable para estudio de datos.

### 6.1 Candidatos

| Candidato   | Bundle size | Write perf           | Query power                          | ETL necesario          | Madurez |
| ----------- | ----------- | -------------------- | ------------------------------------ | ---------------------- | ------- |
| **SQLite**  | ~3MB        | Buena (serial)       | SQL estándar                         | Sí (JSONL→tablas)      | ★★★★★   |
| **DuckDB**  | ~30MB       | Muy buena (columnar) | SQL analítico + window + percentiles | No (lee JSONL directo) | ★★★     |
| **Parquet** | 0 (formato) | Muy buena            | Nulo (necesita reader)               | N/A es destino         | ★★★★    |

### 6.2 Hipótesis a validar en el estudio

- ¿El patrón de lectura es queries agregadas (GROUP BY, percentiles) o acceso a eventos individuales?
- ¿Volumen esperado? (afecta si columnar gana)
- ¿Setup complexity tolerable para el usuario?
- ¿Convivencia con JSONL o reemplazo total?

### 6.3 Estudio (spike, sin implementar)

- Documento de tradeoffs en `docs/persistence-tradeoffs.md`
- Prototipo de cada opción con fixture de 10k eventos
- Métricas: write throughput, query latency (3 queries típicas), bundle size, complejidad de setup
- Decisión documentada antes de escribir código de producción

---

## No-objetivos (explícitos)

- **No** es un APM completo (no reemplaza Datadog/NewRelic)
- **No** envía telemetría a servicios externos
- **No** muta el comportamiento de OpenCode — sólo observa
- **No** soporta multi-tenant / multi-project routing en v0.x
- **No** incluye tool LLM-callable (el TUI cubre display; el script cubre extracción)

---

## Métricas de éxito del proyecto

- Downloads npm (proxy de adopción)
- Issues abiertos / tiempo medio de cierre (proxy de calidad)
- Coverage de tests (objetivo >80% en handlers y metrics)
- Tiempo desde `llm_call` start hasta trace en disco (objetivo <10ms p95)

---

## Orden de ejecución (revisado 2026-06-16)

<<<<<<< HEAD

1. **Fase 0** (automation) ✅ release-please, commitlint, husky operativos
2. **Fase 1** (publicación) ✅ `0.1.1` en npm
3. **Fase 2** (aggregator) ✅ `MetricsAggregator` con bySession, byAgent, byModel, byAgentModel
4. **Fase 3.5** (TUI widget) ✅ completado (30 tests, panel sidebar + diálogo fullscreen + byAgentModel)
5. **Release 0.2.0** → merge develop → main, release-please auto-bump, publish
6. **Fase 2.5** (extender aggregator) → `byTool`, `errors[]`, `snapshot({ filters })`, formatters, refactor script
7. **Fase 5.a** (`schemaVersion: 1`) → campo aditivo en cada evento
8. **Release 0.3.0** → aggregator extendido + schema, bajo riesgo, release-please auto
9. **Observar estabilidad** → sin nuevas features
10. **Re-evaluar**: Fase 5.b (crecimiento disco), Fase 6 (persistencia), Fase 4 (CLI)
11. **Fase 5.c/d/e/f** → según decisión post-estabilidad
12. # **Release 0.4.0** → crecimiento disco + `dispose()` + persistencia si se decide
13. ✅ **Fase 0** (automation) → release-please, commitlint, husky operativos
14. ✅ **Fase 1** (publicación) → `0.1.1` en npm
15. ✅ **Fase 2** (aggregator) → tests verdes, sin API pública
16. ✅ **Fase 3** (tool) → demo end-to-end con LLM
17. ❌ **Fase 4** (CLI) → binario funcional
18. 🔜 Release conjunto: **`0.2.0`** con tool + CLI + métricas (auto via release-please)
19. ❌ **Fase 5** (polish) → `0.3.0`
    > > > > > > > develop

---

## Open questions / decisiones pendientes (revisado 2026-06-16)

- ✅ ¿Publicar con provenance? Sí (configurado con OIDC + GitHub Actions)
- ✅ ¿Internal-only events (`write_trace_error`) deben contarse en métricas? No
- ❌ Fase 3 (tool LLM): **eliminada** — no aporta valor de estudio, TUI cubre display
- ⏸ Fase 4 (CLI): **diferida** post-persistencia — script `metrics.mts` cubre extracción actual
- ⏸ Fase 6 (persistencia): ¿SQLite, DuckDB, Parquet, o híbrido? → estudio pendiente
- ⏸ Crecimiento de disco: ¿rotación, compaction, sampling? → diseño post-estabilidad 0.3.0
- ⏸ ¿Añadir `bin/` como entry point? → reevaluar con Fase 4 post-persistencia
