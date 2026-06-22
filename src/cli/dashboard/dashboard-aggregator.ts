/**
 * Dashboard Aggregator — builds `DashboardData` from a `MetricsSnapshot`
 * and raw `TraceEvent[]`.
 *
 * Pure logic, no I/O. Uses the Processor pattern so each panel has a single
 * responsibility and new panels can be added without touching existing code.
 *
 * Design decisions:
 * - Single pass over events (one iteration feeds all processors).
 * - Each processor implements `EventProcessor<T>` — testable in isolation.
 * - Tool/skill panels share a base processor (`AbstractUsageProcessor`).
 * - Type guards dispatch by `event.type` instead of unsafe casts.
 * - `cost` is omitted from ToolRow / SkillRow because the event types
 *   do not carry cost data. Add proportional allocation when needed.
 */
import type {
  TraceEvent,
  LlmCallEvent,
  ToolCallEvent,
  SkillCallEvent,
  SessionErrorEvent,
} from "../../shared/trace-events.types";
import { TraceEventType } from "../../shared/enums";
import type { MetricsSnapshot } from "../../shared/metrics.types";
import type {
  SessionCost,
  CostByModel,
  TokenBucket,
  ToolRow,
  TimelineRow,
  ErrorRow,
  DashboardData,
} from "./dashboard.types";

// ── Processor contract ──────────────────────────────────────────────────────

/**
 * Single-responsibility processor for one dashboard panel.
 *
 * Implementations accumulate state across `process()` calls, then return
 * the panel data via `result()`. Processors are reusable — call `reset()`
 * or create a new instance per `build()` invocation.
 */
interface EventProcessor<T> {
  /** Feed one event to the processor. */
  process(event: TraceEvent): void;
  /** Return the accumulated panel data. Idempotent. */
  result(): T;
}

// ── Costs ───────────────────────────────────────────────────────────────────

class CostProcessor implements EventProcessor<SessionCost[]> {
  /** sessionID → model → cost */
  private costMap = new Map<string, Map<string, number>>();

  process(event: TraceEvent): void {
    if (event.type !== TraceEventType.LLM_CALL) return;
    const { sessionID, model, cost } = event as LlmCallEvent;
    let models = this.costMap.get(sessionID);
    if (!models) {
      models = new Map<string, number>();
      this.costMap.set(sessionID, models);
    }
    models.set(model, (models.get(model) ?? 0) + cost);
  }

  result(): SessionCost[] {
    const out: SessionCost[] = [];
    for (const [sessionID, models] of this.costMap) {
      const byModel: CostByModel = {};
      let total = 0;
      for (const [model, cost] of models) {
        byModel[model] = cost;
        total += cost;
      }
      out.push({ sessionID, total, byModel });
    }
    return out;
  }
}

// ── Tokens ──────────────────────────────────────────────────────────────────

class TokenProcessor implements EventProcessor<TokenBucket[]> {
  /** sessionID → accumulated tokens */
  private tokenMap = new Map<
    string,
    { input: number; output: number; reasoning: number }
  >();

  process(event: TraceEvent): void {
    if (event.type !== TraceEventType.LLM_CALL) return;
    const { sessionID, inputTokens, outputTokens, reasoningTokens } =
      event as LlmCallEvent;
    const current = this.tokenMap.get(sessionID) ?? {
      input: 0,
      output: 0,
      reasoning: 0,
    };
    current.input += inputTokens;
    current.output += outputTokens;
    current.reasoning += reasoningTokens;
    this.tokenMap.set(sessionID, current);
  }

  result(): TokenBucket[] {
    const out: TokenBucket[] = [];
    for (const [sessionID, t] of this.tokenMap) {
      out.push({
        sessionID,
        input: t.input,
        output: t.output,
        reasoning: t.reasoning,
      });
    }
    return out;
  }
}

// ── Tools / Skills (shared structure) ───────────────────────────────────────

/**
 * Shared accumulator for tool-like events (TOOL_CALL, SKILL_CALL).
 *
 * Both event types carry: name, status, durationMs, and an optional error.
 * The `getKey()` and `getName()` abstractions let the same logic serve both
 * panels without duplication.
 */
abstract class AbstractUsageProcessor implements EventProcessor<ToolRow[]> {
  protected abstract eventType: TraceEventType;
  protected abstract getKey(event: TraceEvent): string;

  /** key → accumulator */
  private usageMap = new Map<
    string,
    { calls: number; errors: number; durationMs: number }
  >();

  process(event: TraceEvent): void {
    if (event.type !== this.eventType) return;
    const key = this.getKey(event);
    const current = this.usageMap.get(key) ?? {
      calls: 0,
      errors: 0,
      durationMs: 0,
    };
    current.calls += 1;
    current.durationMs += (event as ToolCallEvent | SkillCallEvent).durationMs;
    if ((event as ToolCallEvent | SkillCallEvent).status === "error")
      current.errors += 1;
    this.usageMap.set(key, current);
  }

  result(): ToolRow[] {
    const out: ToolRow[] = [];
    for (const [key, stats] of this.usageMap) {
      out.push({
        name: key,
        calls: stats.calls,
        errors: stats.errors,
        durationMs: stats.durationMs,
      });
    }
    return out;
  }
}

class ToolProcessor extends AbstractUsageProcessor {
  protected eventType = TraceEventType.TOOL_CALL as const;
  protected getKey(event: TraceEvent): string {
    return (event as ToolCallEvent).tool;
  }
}

class SkillProcessor extends AbstractUsageProcessor {
  protected eventType = TraceEventType.SKILL_CALL as const;
  protected getKey(event: TraceEvent): string {
    return (event as SkillCallEvent).skill;
  }
}

// ── Timeline ─────────────────────────────────────────────────────────────────

class TimelineProcessor implements EventProcessor<TimelineRow[]> {
  private rows: TimelineRow[] = [];

  process(event: TraceEvent): void {
    this.rows.push({
      sessionID: event.sessionID,
      type: event.type,
      durationMs: "durationMs" in event ? (event.durationMs as number) : 0,
      timestamp: event.timestamp,
    });
  }

  result(): TimelineRow[] {
    return [...this.rows].sort((a, b) => a.timestamp - b.timestamp);
  }
}

// ── Errors ──────────────────────────────────────────────────────────────────

class ErrorProcessor implements EventProcessor<ErrorRow[]> {
  /** `${source}|${name}|${message}` → ErrorRow */
  private errorMap = new Map<
    string,
    { tool: string; message: string; sessions: Set<string> }
  >();

  process(event: TraceEvent): void {
    switch (event.type) {
      case TraceEventType.TOOL_CALL: {
        const tc = event as ToolCallEvent;
        if (tc.status !== "error" || !tc.error) return;
        this.add(tc.tool, tc.error, tc.sessionID);
        break;
      }
      case TraceEventType.SKILL_CALL: {
        const sc = event as SkillCallEvent;
        if (sc.status !== "error" || !sc.error) return;
        this.add(sc.skill, sc.error, sc.sessionID);
        break;
      }
      case TraceEventType.SESSION_ERROR: {
        const se = event as SessionErrorEvent;
        const msg = se.errorMessage ?? se.error ?? "Unknown session error";
        this.add("session_error", msg, se.sessionID);
        break;
      }
    }
  }

  private add(tool: string, message: string, sessionID: string): void {
    const key = `${tool}|${message}`;
    const current = this.errorMap.get(key) ?? {
      tool,
      message,
      sessions: new Set<string>(),
    };
    current.sessions.add(sessionID);
    this.errorMap.set(key, current);
  }

  result(): ErrorRow[] {
    const out: ErrorRow[] = [];
    for (const entry of this.errorMap.values()) {
      out.push({
        tool: entry.tool,
        message: entry.message,
        sessions: [...entry.sessions].sort(),
      });
    }
    return out;
  }
}

// ── Public facade ───────────────────────────────────────────────────────────

export class DashboardAggregator {
  /**
   * Build a `DashboardData` snapshot from aggregated metrics and raw events.
   *
   * @param snapshot - Pre-computed MetricsSnapshot (from CliAggregator.aggregate)
   * @param events   - Raw TraceEvent[] for per-session detail the snapshot does not expose
   */
  build(snapshot: MetricsSnapshot, events: TraceEvent[]): DashboardData {
    if (events.length === 0) {
      return {
        generatedAt: Date.now(),
        sessionCount: snapshot.totals.sessionsCreated,
        costs: [],
        tokens: [],
        tools: [],
        skills: [],
        timeline: [],
        errors: [],
        isEmpty: true,
      };
    }

    // Single pass — all processors see every event once
    const processors: EventProcessor<unknown>[] = [
      new CostProcessor(),
      new TokenProcessor(),
      new ToolProcessor(),
      new SkillProcessor(),
      new TimelineProcessor(),
      new ErrorProcessor(),
    ];

    for (const event of events) {
      for (const p of processors) {
        p.process(event);
      }
    }

    const sessionIDs = new Set(events.map((e) => e.sessionID));

    return {
      generatedAt: Date.now(),
      sessionCount: Math.max(snapshot.totals.sessionsCreated, sessionIDs.size),
      costs: (processors[0] as CostProcessor).result(),
      tokens: (processors[1] as TokenProcessor).result(),
      tools: (processors[2] as ToolProcessor).result(),
      skills: (processors[3] as SkillProcessor).result(),
      timeline: (processors[4] as TimelineProcessor).result(),
      errors: (processors[5] as ErrorProcessor).result(),
      isEmpty: false,
    };
  }
}

export const dashboardAggregator = new DashboardAggregator();
