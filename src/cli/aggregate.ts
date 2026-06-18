import type {
  MetricsSnapshot,
  Aggregate,
  ToolStats,
  ErrorEntry,
} from "../shared/metrics.types";
import type { TraceEvent } from "../shared/trace-events.types";
import {
  emptyAggregate,
  emptyToolStats,
  getOrCreateMapEntry,
  addToAggregate,
} from "../shared/aggregate.helpers";

export function aggregate(events: TraceEvent[]): MetricsSnapshot {
  const totals = { ...emptyAggregate(), sessionsCreated: 0, sessionErrors: 0 };
  const byAgent = new Map<string, Aggregate>();
  const byTool = new Map<string, ToolStats>();
  const bySession = new Map<string, Aggregate>();
  const errors: ErrorEntry[] = [];
  let firstSeenAt = 0;
  let lastSeenAt = 0;

  const touch = (ts: number): void => {
    if (!firstSeenAt || ts < firstSeenAt) firstSeenAt = ts;
    if (ts > lastSeenAt) lastSeenAt = ts;
  };

  for (const ev of events) {
    touch(ev.timestamp);
    if (ev.type === "llm_call") {
      const inc: Aggregate = {
        llmCalls: 1,
        llmErrors: 0,
        toolCalls: 0,
        toolErrors: 0,
        tokens: {
          input: ev.inputTokens,
          output: ev.outputTokens,
          reasoning: ev.reasoningTokens,
          cacheRead: ev.cacheRead,
        },
        cost: ev.cost,
        workDurationMs: 0,
      };
      addToAggregate(totals, inc);
      addToAggregate(
        getOrCreateMapEntry(byAgent, ev.agent, emptyAggregate),
        inc,
      );
      addToAggregate(
        getOrCreateMapEntry(bySession, ev.sessionID, emptyAggregate),
        inc,
      );
    } else if (ev.type === "tool_call") {
      totals.toolCalls++;
      if (ev.status === "error") totals.toolErrors++;
      const t = getOrCreateMapEntry(byTool, ev.tool, emptyToolStats);
      t.calls++;
      if (ev.status === "error") t.errors++;
      t.durationMs += ev.durationMs;
      getOrCreateMapEntry(bySession, ev.sessionID, emptyAggregate).toolCalls++;
    } else if (ev.type === "session_created") {
      totals.sessionsCreated++;
      getOrCreateMapEntry(bySession, ev.sessionID, emptyAggregate);
    } else if (ev.type === "session_error") {
      totals.sessionErrors++;
      errors.push({
        sessionID: ev.sessionID,
        type: ev.errorType ?? "Unknown",
        message: ev.errorMessage ?? ev.error ?? "",
        timestamp: ev.timestamp,
      });
    }
  }

  return {
    totals,
    byAgent: Object.fromEntries(byAgent),
    byTool: Object.fromEntries(byTool),
    bySession: Object.fromEntries(bySession),
    byModel: {},
    byAgentModel: {},
    errors,
    window: { firstSeenAt, lastSeenAt },
    lastActiveAgent: null,
  };
}

export function parseDuration(duration: string): number | null {
  if (duration === "all") return null;
  const match = duration.match(/^(\d+)([dh])$/);
  if (!match) return null;
  const value = parseInt(match[1], 10);
  const unit = match[2];
  const ms = unit === "d" ? value * 86_400_000 : value * 3_600_000;
  return Date.now() - ms;
}

export function filterEvents(
  events: TraceEvent[],
  since: number | null,
  sessionID?: string,
): TraceEvent[] {
  let filtered = events;
  if (since !== null) {
    filtered = filtered.filter((ev) => ev.timestamp >= since);
  }
  if (sessionID) {
    filtered = filtered.filter((ev) => {
      if ("sessionID" in ev)
        return (ev as { sessionID: string }).sessionID === sessionID;
      return true;
    });
  }
  return filtered;
}
