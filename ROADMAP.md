# ROADMAP — `@alvarovfon/opencode-agent-monitor`

> Estrategia de evolución post-lanzamiento (1.600+ descargas). Enfocada en estabilidad del dato, observabilidad profunda y optimización de costes.

## Fase A: Blindaje y Valor de Negocio (Inmediato)

**Meta:** Proteger la integridad de los datos de los usuarios actuales y ofrecer ahorros directos.

- **A.1 Comparativa de Costes (Model Simulation):** ✅
  - Implementado `agent-monitor compare`: herramienta que proyecta el gasto real sobre precios de otros modelos (ej. ¿Qué habría costado con GPT-4o-mini vs Claude 3.5?).
  - Ayuda a los usuarios a decidir si están usando el modelo más eficiente para su tarea.
- **A.2 Esquema Versionado (Schema v1):** ✅
  - Implementado `schemaVersion: 1` en todos los eventos JSONL.
  - Documentada política de evolución en README.md.
- **A.3 Gestión de Carga e Integridad (Log Rotation):** ✅
  - Implementado per-session JSONL: cada sesión escribe a su propio archivo.
  - Rotación natural por sesión — sin límite de tamaño, sin contención de archivo único.
  - `Session` con `WriteStream` lazy, append mode para reanudación de sesión.

## Fase B: Deep Insights (Observabilidad)

**Meta:** Entender el "cómo" y "por qué" del comportamiento de los agentes.

- **B.1 Skill & Tool Analytics:**
  - Atribución de costes LLM por ejecución de Skill/Tool.
  - Identificación de "Skills Frágiles" (alta tasa de error) para refinamiento de prompts.
- **B.2 Latencia p95/p99:**
  - Sustituir promedios por percentiles para detectar llamadas "zombie" que degradan la experiencia.
- **B.3 Buffer de Escritura Seguro:**
  - Stream con buffer para evitar bloqueos del event-loop de OpenCode en picos de tráfico.

## Fase C: Ecosistema y Portabilidad

**Meta:** Hacer los datos accesibles fuera de la terminal.

- **C.1 Dashboard HTML (Self-contained):** ✅
  - Exportación a un único archivo `.html` con UI moderna (Tailwind/Chart.js, 6 paneles, theming light/dark) para compartir reportes de sesión.
  - `agent-monitor dashboard [output]` con flags `--dir` y `--theme`.
  - Arquitectura componentizada: `DashboardEngine` + panel registry + Handlebars partials.
- **C.2 Persistencia Híbrida (JSONL + SQLite):**
  - Indexación automática en SQLite para consultas instantáneas en el CLI y reportes históricos masivos.
- **C.3 Alertas Proactivas (Anomaly Detection):**
  - Alertas visuales en el TUI si una sesión supera un presupuesto definido o entra en un bucle infinito de llamadas.

## Fase D: Integración DX Avanzada

- **D.1 Budget Guard:** Barra de progreso de presupuesto en tiempo real en el sidebar del TUI.
- **D.2 CI/CD Integration:** Modo "headless" que falla el pipeline si el ratio de errores o coste supera los límites en pruebas automatizadas.

---

## Estado Actual (Snapshot 2026-06-26)

- ✅ Tracing de eventos base (LLM, Tools, Sessions).
- ✅ TUI Live Monitor (Sidebar + Fullscreen).
- ✅ CLI funcional: `stats`, `errors`, `export`, `compare`, `dashboard`.
- ✅ Dashboard HTML autónomo (C.1): 6 paneles, theming light/dark, Handlebars + panel registry.
- ✅ Distribución en npm (@alvarovfon/opencode-agent-monitor) — última v1.0.3.
- ✅ Fase A.3 (Log Rotation / Per-Session).
- ✅ Fase C.1 (Dashboard HTML).
- 🔜 Próximo hito: Fase B (Deep Insights) — Skill/Tool analytics, latencia p95/p99, buffer seguro.
