/**
 * Dashboard Aggregator — builds `DashboardData` from a `MetricsSnapshot`
 * and raw `TraceEvent[]`.
 *
 * Pure logic, no I/O. Produces the per-session cost-by-model, token
 * buckets, tool/skill rows, timeline, and error grouping that the HTML
 * renderer consumes.
 */
import type {
  TraceEvent,
  LlmCallEvent,
  ToolCallEvent,
  SkillCallEvent,
  SessionErrorEvent,
} from "../shared/trace-events.types";
import { TraceEventType } from "../shared/enums";
import type { MetricsSnapshot } from "../shared/metrics.types";
import type {
  SessionCost,
  CostByModel,
  TokenBucket,
  ToolRow,
  TimelineRow,
  ErrorRow,
  DashboardData,
} from "./dashboard.types";

export class DashboardAggregator {
  build(snapshot: MetricsSnapshot, events: TraceEvent[]): DashboardData {
    const generatedAt = Date.now();

    if (events.length === 0) {
      return {
        generatedAt,
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

    const costs = this.buildSessionCosts(events);
    const tokens = this.buildTokenBuckets(events);
    const tools = this.buildToolRows(events);
    const skills = this.buildSkillRows(events);
    const timeline = this.buildTimeline(events);
    const errors = this.buildErrorRows(events);
    const sessionIDs = new Set(events.map((e) => e.sessionID));

    return {
      generatedAt,
      sessionCount: Math.max(snapshot.totals.sessionsCreated, sessionIDs.size),
      costs,
      tokens,
      tools,
      skills,
      timeline,
      errors,
      isEmpty: false,
    };
  }

  private buildSessionCosts(events: TraceEvent[]): SessionCost[] {
    // Map<sessionID, Map<model, totalCost>>
    const costMap = new Map<string, Map<string, number>>();

    for (const event of events) {
      if (event.type !== TraceEventType.LLM_CALL) continue;
      const llm = event as LlmCallEvent;
      let sessionModels = costMap.get(llm.sessionID);
      if (!sessionModels) {
        sessionModels = new Map<string, number>();
        costMap.set(llm.sessionID, sessionModels);
      }
      const current = sessionModels.get(llm.model) ?? 0;
      sessionModels.set(llm.model, current + llm.cost);
    }

    const result: SessionCost[] = [];
    for (const [sessionID, models] of costMap) {
      const byModel: CostByModel = {};
      let total = 0;
      for (const [model, cost] of models) {
        byModel[model] = cost;
        total += cost;
      }
      result.push({ sessionID, total, byModel });
    }
    return result;
  }

  private buildTokenBuckets(events: TraceEvent[]): TokenBucket[] {
    // Map<sessionID, TokenBucket>
    const tokenMap = new Map<
      string,
      { input: number; output: number; reasoning: number }
    >();

    for (const event of events) {
      if (event.type !== TraceEventType.LLM_CALL) continue;
      const llm = event as LlmCallEvent;
      const current = tokenMap.get(llm.sessionID) ?? {
        input: 0,
        output: 0,
        reasoning: 0,
      };
      current.input += llm.inputTokens;
      current.output += llm.outputTokens;
      current.reasoning += llm.reasoningTokens;
      tokenMap.set(llm.sessionID, current);
    }

    const result: TokenBucket[] = [];
    for (const [sessionID, tokens] of tokenMap) {
      result.push({
        sessionID,
        input: tokens.input,
        output: tokens.output,
        reasoning: tokens.reasoning,
      });
    }
    return result;
  }

  private buildToolRows(events: TraceEvent[]): ToolRow[] {
    // Map<toolName, ToolRow>
    const toolMap = new Map<
      string,
      { calls: number; errors: number; durationMs: number }
    >();

    for (const event of events) {
      if (event.type !== TraceEventType.TOOL_CALL) continue;
      const tool = event as ToolCallEvent;
      const current = toolMap.get(tool.tool) ?? {
        calls: 0,
        errors: 0,
        durationMs: 0,
      };
      current.calls += 1;
      current.durationMs += tool.durationMs;
      if (tool.status === "error") current.errors += 1;
      toolMap.set(tool.tool, current);
    }

    const result: ToolRow[] = [];
    for (const [name, stats] of toolMap) {
      result.push({
        name,
        calls: stats.calls,
        errors: stats.errors,
        durationMs: stats.durationMs,
        cost: 0, // ToolCallEvent does not carry cost data
      });
    }
    return result;
  }

  private buildSkillRows(events: TraceEvent[]): ToolRow[] {
    // Map<skillName, ToolRow> — reuses ToolRow type for the skill panel
    const skillMap = new Map<
      string,
      { calls: number; errors: number; durationMs: number }
    >();

    for (const event of events) {
      if (event.type !== TraceEventType.SKILL_CALL) continue;
      const skill = event as SkillCallEvent;
      const current = skillMap.get(skill.skill) ?? {
        calls: 0,
        errors: 0,
        durationMs: 0,
      };
      current.calls += 1;
      current.durationMs += skill.durationMs;
      if (skill.status === "error") current.errors += 1;
      skillMap.set(skill.skill, current);
    }

    const result: ToolRow[] = [];
    for (const [name, stats] of skillMap) {
      result.push({
        name,
        calls: stats.calls,
        errors: stats.errors,
        durationMs: stats.durationMs,
        cost: 0, // SkillCallEvent does not carry cost data
      });
    }
    return result;
  }

  private buildTimeline(events: TraceEvent[]): TimelineRow[] {
    const rows: TimelineRow[] = [];

    for (const event of events) {
      rows.push({
        sessionID: event.sessionID,
        type: event.type,
        durationMs:
          "durationMs" in event
            ? ((event as Record<string, unknown>).durationMs as number)
            : 0,
        timestamp: event.timestamp,
      });
    }

    rows.sort((a, b) => a.timestamp - b.timestamp);
    return rows;
  }

  private buildErrorRows(events: TraceEvent[]): ErrorRow[] {
    // Map<`tool|message`, ErrorRow>
    const errorMap = new Map<
      string,
      { tool: string; message: string; sessions: Set<string> }
    >();

    for (const event of events) {
      if (event.type === TraceEventType.TOOL_CALL) {
        const tc = event as ToolCallEvent;
        if (tc.status !== "error" || !tc.error) continue;
        const key = `tool|${tc.tool}|${tc.error}`;
        const current = errorMap.get(key) ?? {
          tool: tc.tool,
          message: tc.error,
          sessions: new Set(),
        };
        current.sessions.add(tc.sessionID);
        errorMap.set(key, current);
      } else if (event.type === TraceEventType.SKILL_CALL) {
        const sc = event as SkillCallEvent;
        if (sc.status !== "error" || !sc.error) continue;
        const key = `skill|${sc.skill}|${sc.error}`;
        const current = errorMap.get(key) ?? {
          tool: sc.skill,
          message: sc.error,
          sessions: new Set(),
        };
        current.sessions.add(sc.sessionID);
        errorMap.set(key, current);
      } else if (event.type === TraceEventType.SESSION_ERROR) {
        const se = event as SessionErrorEvent;
        const message = se.errorMessage ?? se.error ?? "Unknown session error";
        const key = `session|${message}`;
        const current = errorMap.get(key) ?? {
          tool: "session_error",
          message,
          sessions: new Set(),
        };
        current.sessions.add(se.sessionID);
        errorMap.set(key, current);
      }
    }

    const result: ErrorRow[] = [];
    for (const entry of errorMap.values()) {
      result.push({
        tool: entry.tool,
        message: entry.message,
        sessions: Array.from(entry.sessions).sort(),
      });
    }
    return result;
  }
}

export const dashboardAggregator = new DashboardAggregator();
