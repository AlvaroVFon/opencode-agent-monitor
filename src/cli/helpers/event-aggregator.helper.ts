import type {
  Aggregate,
  SkillStats,
  ToolStats,
  ErrorEntry,
} from "../../shared/metrics.types";
import type {
  LlmCallEvent,
  ToolCallEvent,
  SkillCallEvent,
  SessionCreatedEvent,
  SessionErrorEvent,
  TraceEvent,
} from "../../shared/trace-events.types";
import { aggregateHelper } from "../../shared/aggregate.helpers";
import { TraceEventType } from "../../shared/enums";

type AggregationState = {
  totals: Aggregate & { sessionsCreated: number; sessionErrors: number };
  byAgent: Map<string, Aggregate>;
  byTool: Map<string, ToolStats>;
  bySkill: Map<string, SkillStats>;
  bySession: Map<string, Aggregate>;
  errors: ErrorEntry[];
};

export class EventAggregatorHelper {
  emptyState(): AggregationState {
    return {
      totals: {
        ...aggregateHelper.empty(),
        sessionsCreated: 0,
        sessionErrors: 0,
      },
      byAgent: new Map(),
      byTool: new Map(),
      bySkill: new Map(),
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
      skillCalls: 0,
      skillErrors: 0,
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
    aggregateHelper.addToAggregate(state.totals, inc);
    aggregateHelper.addToAggregate(
      aggregateHelper.getOrCreate(state.byAgent, event.agent, () =>
        aggregateHelper.empty(),
      ),
      inc,
    );
    aggregateHelper.addToAggregate(
      aggregateHelper.getOrCreate(state.bySession, event.sessionID, () =>
        aggregateHelper.empty(),
      ),
      inc,
    );
  }

  applyToolCall(state: AggregationState, event: ToolCallEvent): void {
    state.totals.toolCalls++;
    if (event.status === "error") state.totals.toolErrors++;
    const t = aggregateHelper.getOrCreate(state.byTool, event.tool, () =>
      aggregateHelper.emptyToolStats(),
    );
    t.calls++;
    if (event.status === "error") t.errors++;
    t.durationMs += event.durationMs;
    aggregateHelper.getOrCreate(state.bySession, event.sessionID, () =>
      aggregateHelper.empty(),
    ).toolCalls++;
  }

  applySkillCall(state: AggregationState, event: SkillCallEvent): void {
    state.totals.skillCalls++;
    if (event.status === "error") state.totals.skillErrors++;
    const s = aggregateHelper.getOrCreate(state.bySkill, event.skill, () =>
      aggregateHelper.emptySkillStats(),
    );
    s.calls++;
    if (event.status === "error") s.errors++;
    const totalDurationMs = s.avgDurationMs * (s.calls - 1) + event.durationMs;
    s.avgDurationMs = totalDurationMs / s.calls;
  }

  applySessionCreated(
    state: AggregationState,
    event: SessionCreatedEvent,
  ): void {
    state.totals.sessionsCreated++;
    aggregateHelper.getOrCreate(state.bySession, event.sessionID, () =>
      aggregateHelper.empty(),
    );
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
    if (event.type === TraceEventType.LLM_CALL) {
      this.applyLlmCall(state, event);
    } else if (event.type === TraceEventType.TOOL_CALL) {
      this.applyToolCall(state, event);
    } else if (event.type === TraceEventType.SKILL_CALL) {
      this.applySkillCall(state, event);
    } else if (event.type === TraceEventType.SESSION_CREATED) {
      this.applySessionCreated(state, event);
    } else if (event.type === TraceEventType.SESSION_ERROR) {
      this.applySessionError(state, event);
    }
  }

  toSnapshot(state: AggregationState, firstSeenAt: number, lastSeenAt: number) {
    return {
      totals: state.totals,
      byAgent: Object.fromEntries(state.byAgent),
      byTool: Object.fromEntries(state.byTool),
      bySkill: Object.fromEntries(state.bySkill),
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
