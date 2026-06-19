# Plan de Mejoras

Basado en el análisis del repositorio (2026-06-18). Propuestas ordenadas por impacto y esfuerzo.

---

## Prioridad Alta (correcciones concretas, esfuerzo bajo)

### 1. ✓ `ToolCallHandler` — Reemplazar strings literales por enums

**Archivo**: `src/server/handlers/tool-call.handler.ts:12-13`

```typescript
// ❌ Actual
if (part.type !== "tool") return;
if (part.state.status !== "completed" && part.state.status !== "error") return;

// ✅ Propuesto
if (part.type !== PartType.TOOL) return;
if (
  part.state.status !== PartStatus.COMPLETED &&
  part.state.status !== PartStatus.ERROR
)
  return;
```

Afecta también `ToolCallHandler` en el TUI si existe. Esfuerzo: 5 min, un test actualizado.

### 2. ✓ Hacer `MetricsAggregator.init()` innecesario — unificar construcción

**Archivo**: `src/server/metrics/metrics.aggregator.ts`

El `init()` bifásico se debe a la dependencia circular: `buildMetricsHandlersRegistry` necesita el aggregator, el aggregator necesita el registry. Solución: pasar los callbacks directamente.

```typescript
// ❌ Actual
const aggregator = new MetricsAggregator(currentAgent, helper, filter);
aggregator.init(buildMetricsHandlersRegistry(aggregator));

// ✅ Propuesto
// Eliminar init(), recibir callbacks en constructor
type IngestHandler = {
  onMessage: (props: MessageUpdatedProps) => void;
  onPart: (props: MessagePartUpdatedProps) => void;
  onSessionCreated: (props: SessionCreatedProps) => void;
  onSessionError: (props: SessionErrorProps) => void;
};

constructor(
  private readonly currentAgent: Map<string, string>,
  private readonly helper: MetricsAggregatorHelper,
  private readonly handlers: IngestHandler,  // ← en lugar de registry
  private readonly filterHelper: SnapshotFilterHelper,
)
```

Y en `aggregator-wiring.ts` pasar handlers inline. Esfuerzo: ~30 min.

### 3. ✓ Unificar `ensureDir()` — cachear existencia del directorio

**Archivo**: `src/server/helpers/trace.helpers.ts`

El `ensureDir()` se llama en cada `writeTrace`. En la práctica el directorio rara vez desaparece. Propuesta:

```typescript
export class TraceHelper {
  private dirEnsured = false;

  ensureDir() {
    if (this.dirEnsured) return; // ← cache
    if (!existsSync(this.traceDir)) {
      mkdirSync(this.traceDir, { recursive: true });
    }
    this.dirEnsured = true;
  }
}
```

Esfuerzo: 10 min.

### 4. ✓ Consistencia en nombres de exportación

| Archivo                                           | Convención seguida                                                |
| ------------------------------------------------- | ----------------------------------------------------------------- |
| `src/cli/aggregate.ts`                            | Clase `CliAggregator` + singleton `cliAggregator`                 |
| `src/cli/reader.ts`                               | Clase `TraceReader` + singleton `traceReader`                     |
| `src/tui/helpers/aggregate.helper.ts`             | Clase `AggregateHelper` + singleton `aggregateHelper`             |
| `src/server/helpers/metrics-aggregator.helper.ts` | Solo clase `MetricsAggregatorHelper` (instanciado en wiring)      |
| `src/cli/helpers/event-aggregator.helper.ts`      | Clase `EventAggregatorHelper` + singleton `eventAggregatorHelper` |
| `src/cli/helpers/window.helper.ts`                | Clase `WindowHelper` + singleton `windowHelper`                   |

La convención está documentada en `AGENTS.md`:

- PascalCase para clases, camelCase para singletons
- CLI/TUI exportan singleton inline (leaf utilities)
- Server side exporta solo la clase; instanciación en `wire/` factories

✅ Cerrado: ya se sigue la convención, solo se documentó.

---

## Prioridad Media (refactor local, esfuerzo medio)

### 5. ✓ Hacer `Handler` genérico — eliminar casts de `unknown`

**Archivos**: `src/server/handler.interface.ts`, todos los handlers, `EventsRegistry`

Propuesta: parametrizar `Handler<T>` y restringir el registry por EventType.

```typescript
// handler.interface.ts
export interface Handler<T = unknown> {
  handle(properties: T): void;
}

// events.registry.ts
export type HandlerMap = {
  [EventType.SESSION_CREATED]: Handler<SessionCreatedProps>;
  [EventType.SESSION_ERROR]: Handler<SessionErrorProps>;
  [EventType.MESSAGE_UPDATED]: Handler<MessageUpdatedProps>;
  [EventType.MESSAGE_PART_UPDATED]: Handler<MessagePartUpdatedProps>;
};

// register acepta solo el tipo correcto
register<E extends EventType>(type: E, handler: HandlerMap[E]): this;
```

Esto mueve el error de runtime a compile-time. Esfuerzo: ~2h (toca los 8 handlers, registry, y tests).

### ✓ 6. `currentAgent` — eliminar estado mutable global

**Archivo**: `src/server/agent-monitor.ts`

El Map mutable compartido entre hooks puede dar lecturas inconsistentes. Propuesta:

**Opción A** (recomendada): Capturar el agente en el propio event properties.

```typescript
event: async ({ event }) => {
  const agent = currentAgent.get(event.sessionID) ?? UNKNOWN;
  // pasar agent como parte del contexto, no leer del Map dentro de handlers
  eventHandler.handle(event, agent);
  metricsAggregator.ingest(event, agent);
};
```

**Opción B** (mínima): Copia defensiva en cada evento.

```typescript
event: async ({ event }) => {
  const agentSnapshot = new Map(currentAgent); // snapshot point-in-time
  eventHandler.handle(event, agentSnapshot);
  metricsAggregator.ingest(event, agentSnapshot);
};
```

Esfuerzo: Opción A ~1h, Opción B ~30 min.

### 7. Tests — habilitar type-check para `src/test/`

**Archivo**: `tsconfig.json`

```json
// ❌ Actual
"excludes": ["node_modules", "src/test"]

// ✅ Propósito: añadir un tsconfig separado para tests
// tsconfig.test.json
{
  "extends": "./tsconfig.json",
  "include": ["src/test/**/*.ts", "src/test/**/*.tsx"],
  "compilerOptions": {
    "noEmit": true,
    "types": ["node"]
  }
}
```

Y en `package.json`:

```json
"lint:test": "tsc -p tsconfig.test.json --noEmit"
```

O añadir `"src/test"` al tsconfig principal si no hay conflictos. Esfuerzo: 30 min.

---

## Prioridad Alta-Estructural (refactor mayor, esfuerzo alto)

### ✓ 8. Unificar los helpers de agregación

**El mayor problema del código base**. Actualmente hay 4 implementaciones:

| Archivo                                           | Qué ofrece                                                                                                                                                                      |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/shared/aggregate.helpers.ts`                 | `emptyAggregate()`, `emptyToolStats()`, `addToAggregate()`, `getOrCreateMapEntry()`, `cloneAggregate()`                                                                         |
| `src/server/helpers/metrics-aggregator.helper.ts` | Clase `MetricsAggregatorHelper` con `emptyAggregate()`, `addToAggregate()`, `addTokens()`, `cloneAggregate()`, `mapToRecord()`, `mapToNestedRecord()`, `mapToToolStatsRecord()` |
| `src/tui/helpers/aggregate.helper.ts`             | Clase `AggregateHelper` con `empty()`, `clone()`, `getOrCreate()`, `emptySession()`, `cloneSession()`                                                                           |
| `src/cli/helpers/event-aggregator.helper.ts`      | Clase `EventAggregatorHelper` con `emptyState()`, `apply()`, `toSnapshot()`                                                                                                     |

**Propuesta**: Eliminar duplicación moviendo todo a `src/shared/`:

```
src/shared/aggregate.helpers.ts  →  funciones puras existentes + exportar clase de conveniencia
src/server/helpers/metrics-aggregator.helper.ts  →  eliminar, usar shared
src/tui/helpers/aggregate.helper.ts              →  eliminar, usar shared + SessionAggregate como type alias
src/cli/helpers/event-aggregator.helper.ts       →  refactor para usar shared
src/cli/helpers/window.helper.ts                 →  mover a shared (es pura)
```

Los helpers de conversión Map→Record (`mapToRecord`, `mapToNestedRecord`) pueden vivir en shared sin dependencias. El `CliAggregator` y `MetricsAggregator` pueden tener sus propias clases concreta pero usar las mismas funciones de agregación.

**Riesgo**: ADR-002 dice explícitamente que `AggregatorStore` y `MetricsAggregator` no deben compartir runtime. Esta mejora propone violar esa ADR. La ADR debería actualizarse para reflejar que las _funciones de agregación_ sí se comparten (son lógica pura), aunque los _agregadores_ sigan siendo clases separadas.

**Esfuerzo**: ~4h. Afecta shared, server, tui, cli y todos los tests correspondientes.

---

## Prioridad Baja (mejoras deseables)

### 9. `CliAggregator` — eliminar doble agregación en `applyTopFilter`

**Archivo**: `src/cli/commands/stats.command.ts:66-88`

Actualmente se llama `aggregate()` dos veces. Propuesta: encontrar top agents recorriendo los eventos una sola vez, acumulando por agente y luego filtrando.

Esfuerzo: ~1h.

### 10. `MetricsAggregator.snapshot()` — filtros sobre datos crudos

Actualmente los filtros (`since`, `sessionID`) operan sobre snapshots preagregadas, no sobre los datos fuente. Esto da resultados incompletos (ej: `sessionID` oculta otras entradas de `byAgent`). Propuesta: mantener un registro de eventos crudos limitado (ventana de tiempo) y re-agregar bajo demanda. Alternativamente: documentar que los filtros solo ocultan entradas, no re-agregan.

Esfuerzo: ~3h para re-agregación real, 15 min para documentar limitación.

### 11. Tests — eliminar `as any` en contructores de handlers

Reemplazar con factories de test que construyan el mínimo necesario del helper. Propuesta a largo plazo.

---

## Resumen de Priorización

| #    | Mejora                                  | Esfuerzo | Impacto                   | Prioridad           |
| ---- | --------------------------------------- | -------- | ------------------------- | ------------------- |
| 1 ✅ | Enums en ToolCallHandler                | 5 min    | medio (consistencia)      | 🔴 Alta             |
| 2 ✅ | Unificar construcción MetricsAggregator | 30 min   | medio (code smell)        | 🔴 Alta             |
| 3 ✅ | Cachear ensureDir                       | 10 min   | bajo (perf)               | 🔴 Alta             |
| 4 ✅ | Consistencia exports                    | 15 min   | bajo (convención)         | 🔴 Alta             |
| 5 ✅ | Handler genérico                        | 2h       | alto (type safety)        | 🟡 Media            |
| 6    | Eliminar currentAgent mutable           | 1h       | alto (fiabilidad)         | 🟡 Media            |
| 7    | Type-check en tests                     | 30 min   | medio (calidad)           | 🟡 Media            |
| 8 ✅ | Unificar helpers agregación             | 4h       | muy alto (mantenibilidad) | 🔴 Alta-Estructural |
| 9    | Doble agregación CLI                    | 1h       | bajo (perf)               | 🟢 Baja             |
| 10   | Filtros snapshot                        | 3h       | medio (precisión)         | 🟢 Baja             |
| 11   | Eliminar as any en tests                | —        | bajo                      | 🟢 Baja             |

Se recomienda abordar primero el bloque **#8** (unificación de helpers) porque:

- Elimina 4 implementaciones duplicadas
- Reduce el riesgo de divergencia por campo nuevo
- Desbloquea simplificaciones en server, tui y cli

E implementar **#5** + **#6** en paralelo porque mejoran significativamente la type-safety sin cambiar la arquitectura.
