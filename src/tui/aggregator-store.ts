import type {
  Aggregate,
  ErrorEntry,
  MetricsSnapshot,
  ToolStats,
} from "../shared/metrics.types";
import type {
  LlmCallEvent,
  ToolCallEvent,
  TraceEvent,
} from "../shared/trace-events.types";
import {
  aggregateHelper,
  type SessionAggregate,
} from "./helpers/aggregate.helper.js";

export type { TraceEvent };

// ---------------------------------------------------------------------------
// AggregatorStore
// ---------------------------------------------------------------------------

export class AggregatorStore {
  private totals: Aggregate & {
    sessionsCreated: number;
    sessionErrors: number;
  };
  private byAgent: Map<string, Aggregate>;
  private bySession: Map<string, SessionAggregate>;
  private bySessionAgent: Map<string, Map<string, Aggregate>>;
  private bySessionAgentModel: Map<string, Map<string, Map<string, Aggregate>>>;
  private byModel: Map<string, Aggregate>;
  private byAgentModel: Map<string, Map<string, Aggregate>>;
  private byTool: Map<string, ToolStats>;
  private errors: ErrorEntry[];
  private firstSeenAt: number;
  private lastSeenAt: number;
  private lastActiveAgent: { name: string; timestamp: number } | null;
  private readonly onSnapshot?: (snap: MetricsSnapshot) => void;

  constructor(opts?: { onSnapshot?: (snap: MetricsSnapshot) => void }) {
    this.onSnapshot = opts?.onSnapshot;
    this.totals = this.zeroedTotals();
    this.byAgent = new Map();
    this.bySession = new Map();
    this.bySessionAgent = new Map();
    this.bySessionAgentModel = new Map();
    this.byModel = new Map();
    this.byAgentModel = new Map();
    this.byTool = new Map();
    this.errors = [];
    this.firstSeenAt = 0;
    this.lastSeenAt = 0;
    this.lastActiveAgent = null;
  }

  ingest(event: TraceEvent): void {
    this.touch(event.timestamp);

    switch (event.type) {
      case "llm_call": {
        this.addLlm(this.totals, event);
        this.addLlm(this.getAgent(event.agent), event);
        this.addLlm(this.getSession(event.sessionID), event);
        this.addLlm(this.getModel(event.model), event);
        this.addLlm(this.getAgentModel(event.agent, event.model), event);
        this.addLlm(this.getSessionAgent(event.sessionID, event.agent), event);
        this.addLlm(
          this.getSessionAgentModel(event.sessionID, event.agent, event.model),
          event,
        );

        // Track the most recent active agent (out-of-order safe).
        if (
          this.lastActiveAgent === null ||
          event.timestamp >= this.lastActiveAgent.timestamp
        ) {
          this.lastActiveAgent = {
            name: event.agent,
            timestamp: event.timestamp,
          };
        }
        break;
      }

      case "tool_call": {
        this.addTool(this.totals, event);
        this.addTool(this.getSession(event.sessionID), event);
        this.addToolStats(this.getTool(event.tool), event);
        if (event.status === "error" && event.error) {
          this.pushError({
            sessionID: event.sessionID,
            type: "tool_error",
            message: event.error,
            timestamp: event.timestamp,
          });
        }
        break;
      }

      case "session_created": {
        this.totals.sessionsCreated += 1;
        this.getSession(event.sessionID);
        break;
      }

      case "session_error": {
        this.totals.sessionErrors += 1;
        this.getSession(event.sessionID).sessionErrors += 1;
        this.pushError({
          sessionID: event.sessionID,
          type: event.errorType ?? "session_error",
          message: event.errorMessage ?? "",
          timestamp: event.timestamp,
        });
        break;
      }

      case "agent_delegation":
      default: {
        // No aggregation required for delegation events.
        break;
      }
    }

    this.emitSnapshot();
  }

  snapshot(opts?: { sessionID?: string }): MetricsSnapshot {
    if (opts?.sessionID) {
      return this.filteredSnapshot(opts.sessionID);
    }
    return this.fullSnapshot();
  }

  private fullSnapshot(): MetricsSnapshot {
    return {
      totals: {
        ...aggregateHelper.clone(this.totals),
        sessionsCreated: this.totals.sessionsCreated,
        sessionErrors: this.totals.sessionErrors,
      },
      byAgent: this.mapToRecord(this.byAgent, (v) => aggregateHelper.clone(v)),
      bySession: this.mapToRecord(this.bySession, (v) =>
        aggregateHelper.cloneSession(v),
      ),
      byModel: this.mapToRecord(this.byModel, (v) => aggregateHelper.clone(v)),
      byAgentModel: this.cloneAgentModelRecord(),
      byTool: this.mapToRecord(this.byTool, (v) => ({ ...v })),
      errors: this.errors.map((e) => ({ ...e })),
      ...this.snapshotFooter(),
    };
  }

  private filteredSnapshot(sessionID: string): MetricsSnapshot {
    const sessionAgg = this.bySession.get(sessionID);
    if (!sessionAgg) {
      return {
        totals: this.zeroedTotals(),
        bySession: {},
        byAgent: {},
        byModel: {},
        byAgentModel: {},
        byTool: {},
        errors: [],
        ...this.snapshotFooter(),
      };
    }

    const agentMap = this.bySessionAgent.get(sessionID);
    const agentNames = agentMap ? new Set(agentMap.keys()) : new Set<string>();

    const sessionModelMap = this.bySessionAgentModel.get(sessionID);
    const filteredByAgentModel: Record<string, Record<string, Aggregate>> = {};
    if (sessionModelMap) {
      for (const [agent, modelMap] of sessionModelMap) {
        if (!agentNames.has(agent)) continue;
        filteredByAgentModel[agent] = this.mapToRecord(modelMap, (v) =>
          aggregateHelper.clone(v),
        );
      }
    }

    return {
      totals: {
        ...aggregateHelper.clone(sessionAgg),
        sessionsCreated: 1,
        sessionErrors: sessionAgg.sessionErrors,
      },
      bySession: { [sessionID]: aggregateHelper.clone(sessionAgg) },
      byAgent: this.mapToRecord(agentMap ?? new Map(), (v) =>
        aggregateHelper.clone(v),
      ),
      byModel: {},
      byAgentModel: filteredByAgentModel,
      byTool: {},
      errors: this.errors
        .filter((e) => e.sessionID === sessionID)
        .map((e) => ({ ...e })),
      ...this.snapshotFooter(),
    };
  }

  reset(): void {
    this.totals = this.zeroedTotals();
    this.byAgent = new Map();
    this.bySession = new Map();
    this.bySessionAgent = new Map();
    this.bySessionAgentModel = new Map();
    this.byModel = new Map();
    this.byAgentModel = new Map();
    this.byTool = new Map();
    this.errors = [];
    this.firstSeenAt = 0;
    this.lastSeenAt = 0;
    this.lastActiveAgent = null;
  }

  private touch(timestamp: number): void {
    if (this.firstSeenAt === 0 || timestamp < this.firstSeenAt) {
      this.firstSeenAt = timestamp;
    }
    if (timestamp > this.lastSeenAt) {
      this.lastSeenAt = timestamp;
    }
  }

  private addLlm(aggregate: Aggregate, event: LlmCallEvent): void {
    aggregate.llmCalls += 1;
    aggregate.tokens.input += event.inputTokens;
    aggregate.tokens.output += event.outputTokens;
    aggregate.tokens.reasoning += event.reasoningTokens;
    aggregate.tokens.cacheRead += event.cacheRead;
    aggregate.cost += event.cost;
    aggregate.workDurationMs += event.durationMs;
  }

  private addTool(aggregate: Aggregate, event: ToolCallEvent): void {
    aggregate.toolCalls += 1;
    if (event.status === "error") {
      aggregate.toolErrors += 1;
    }
  }

  private getAgent(agent: string): Aggregate {
    return aggregateHelper.getOrCreate(this.byAgent, agent, () =>
      aggregateHelper.empty(),
    );
  }

  private getSession(sessionID: string): SessionAggregate {
    return aggregateHelper.getOrCreate(this.bySession, sessionID, () =>
      aggregateHelper.emptySession(),
    );
  }

  private getSessionAgent(sessionID: string, agent: string): Aggregate {
    let agentMap = this.bySessionAgent.get(sessionID);
    if (!agentMap) {
      agentMap = new Map();
      this.bySessionAgent.set(sessionID, agentMap);
    }
    return aggregateHelper.getOrCreate(agentMap, agent, () =>
      aggregateHelper.empty(),
    );
  }

  private getSessionAgentModel(
    sessionID: string,
    agent: string,
    model: string,
  ): Aggregate {
    let agentMap = this.bySessionAgentModel.get(sessionID);
    if (!agentMap) {
      agentMap = new Map();
      this.bySessionAgentModel.set(sessionID, agentMap);
    }
    let modelMap = agentMap.get(agent);
    if (!modelMap) {
      modelMap = new Map();
      agentMap.set(agent, modelMap);
    }
    return aggregateHelper.getOrCreate(modelMap, model, () =>
      aggregateHelper.empty(),
    );
  }

  private getModel(model: string): Aggregate {
    return aggregateHelper.getOrCreate(this.byModel, model, () =>
      aggregateHelper.empty(),
    );
  }

  private getAgentModel(agent: string, model: string): Aggregate {
    let inner = this.byAgentModel.get(agent);
    if (!inner) {
      inner = new Map();
      this.byAgentModel.set(agent, inner);
    }
    return aggregateHelper.getOrCreate(inner, model, () =>
      aggregateHelper.empty(),
    );
  }

  private getTool(tool: string): ToolStats {
    return aggregateHelper.getOrCreate(this.byTool, tool, () => ({
      calls: 0,
      errors: 0,
      durationMs: 0,
    }));
  }

  private addToolStats(target: ToolStats, event: ToolCallEvent): void {
    target.calls += 1;
    if (event.status === "error") {
      target.errors += 1;
    }
    target.durationMs += event.durationMs;
  }

  private pushError(entry: ErrorEntry): void {
    if (this.errors.length >= 1000) {
      this.errors.shift();
    }
    this.errors.push(entry);
  }

  private zeroedTotals(): Aggregate & {
    sessionsCreated: number;
    sessionErrors: number;
  } {
    return {
      ...aggregateHelper.empty(),
      sessionsCreated: 0,
      sessionErrors: 0,
    };
  }

  private snapshotFooter(): Pick<
    MetricsSnapshot,
    "window" | "lastActiveAgent"
  > {
    return {
      window: {
        firstSeenAt: this.firstSeenAt,
        lastSeenAt: this.lastSeenAt,
      },
      lastActiveAgent: this.lastActiveAgent
        ? { ...this.lastActiveAgent }
        : null,
    };
  }

  private mapToRecord<T>(
    map: Map<string, T>,
    clone: (item: T) => T,
  ): Record<string, T> {
    return Object.fromEntries(
      Array.from(map.entries()).map(([k, v]) => [k, clone(v)]),
    );
  }

  private cloneAgentModelRecord(): Record<string, Record<string, Aggregate>> {
    return Object.fromEntries(
      Array.from(this.byAgentModel.entries()).map(([agent, inner]) => [
        agent,
        Object.fromEntries(
          Array.from(inner.entries()).map(([model, agg]) => [
            model,
            aggregateHelper.clone(agg),
          ]),
        ),
      ]),
    );
  }

  private emitSnapshot(): void {
    this.onSnapshot?.(this.fullSnapshot());
  }
}
