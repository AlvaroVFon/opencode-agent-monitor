import type {
  Aggregate,
  ToolStats,
  ErrorEntry,
} from "../../shared/metrics.types";
import type {
  LlmCallEvent,
  ToolCallEvent,
  SessionCreatedEvent,
  SessionErrorEvent,
  TraceEvent,
} from "../../shared/trace-events.types";
import {
  emptyAggregate,
  emptyToolStats,
  getOrCreateMapEntry,
  addToAggregate,
} from "../../shared/aggregate.helpers";

export type AggregationState = {
  totals: Aggregate & { sessionsCreated: number; sessionErrors: number };
  byAgent: Map<string, Aggregate>;
  byTool: Map<string, ToolStats>;
  bySession: Map<string, Aggregate>;
  errors: ErrorEntry[];
};

export class EventAggregatorHelper {
  emptyState(): AggregationState {
    return {
      totals: { ...emptyAggregate(), sessionsCreated: 0, sessionErrors: 0 },
      byAgent: new Map(),
      byTool: new Map(),
      bySession: new Map(),
      errors: [],
    };
  }

  buildLlmIncrement(event: LlmCallEvent): Aggregate {
    return {
      llmCalls: 1,
      llmErrors: 0,
      toolCalls: 0,
      toolErrors: 0,
      tokens: {
        input: event.inputTokens,
        output: event.outputTokens,
        reasoning: event.reasoningTokens,
        cacheRead: event.cacheRead,
      },
      cost: event.cost,
      workDurationMs: 0,
    };
  }

  applyLlmCall(state: AggregationState, event: LlmCallEvent): void {
    const inc = this.buildLlmIncrement(event);
    addToAggregate(state.totals, inc);
    addToAggregate(
      getOrCreateMapEntry(state.byAgent, event.agent, emptyAggregate),
      inc,
    );
    addToAggregate(
      getOrCreateMapEntry(state.bySession, event.sessionID, emptyAggregate),
      inc,
    );
  }

  applyToolCall(state: AggregationState, event: ToolCallEvent): void {
    state.totals.toolCalls++;
    if (event.status === "error") state.totals.toolErrors++;
    const t = getOrCreateMapEntry(state.byTool, event.tool, emptyToolStats);
    t.calls++;
    if (event.status === "error") t.errors++;
    t.durationMs += event.durationMs;
    getOrCreateMapEntry(state.bySession, event.sessionID, emptyAggregate)
      .toolCalls++;
  }

  applySessionCreated(
    state: AggregationState,
    event: SessionCreatedEvent,
  ): void {
    state.totals.sessionsCreated++;
    getOrCreateMapEntry(state.bySession, event.sessionID, emptyAggregate);
  }

  applySessionError(state: AggregationState, event: SessionErrorEvent): void {
    state.totals.sessionErrors++;
    state.errors.push({
      sessionID: event.sessionID,
      type: event.errorType ?? "Unknown",
      message: event.errorMessage ?? event.error ?? "",
      timestamp: event.timestamp,
    });
  }

  apply(state: AggregationState, event: TraceEvent): void {
    if (event.type === "llm_call") {
      this.applyLlmCall(state, event);
    } else if (event.type === "tool_call") {
      this.applyToolCall(state, event);
    } else if (event.type === "session_created") {
      this.applySessionCreated(state, event);
    } else if (event.type === "session_error") {
      this.applySessionError(state, event);
    }
  }

  toSnapshot(state: AggregationState, firstSeenAt: number, lastSeenAt: number) {
    return {
      totals: state.totals,
      byAgent: Object.fromEntries(state.byAgent),
      byTool: Object.fromEntries(state.byTool),
      bySession: Object.fromEntries(state.bySession),
      byModel: {} as Record<string, Aggregate>,
      byAgentModel: {} as Record<string, Record<string, Aggregate>>,
      errors: state.errors,
      window: { firstSeenAt, lastSeenAt },
      lastActiveAgent: null,
    };
  }
}

export const eventAggregatorHelper = new EventAggregatorHelper();
