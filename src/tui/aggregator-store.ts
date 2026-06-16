import type { Aggregate, MetricsSnapshot } from "../shared/metrics.types";

// ---------------------------------------------------------------------------
// TraceEvent — the shape produced by the JSONL tailer from trace.jsonl files.
// These are distinct from the OpenCode SDK events consumed by
// MetricsAggregator.
// ---------------------------------------------------------------------------

type LlmCallEvent = {
  type: "llm_call";
  sessionID: string;
  agent: string;
  model: string;
  finish: string;
  inputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  cacheRead: number;
  cost: number;
  durationMs: number;
  timestamp: number;
};

type ToolCallEvent = {
  type: "tool_call";
  sessionID: string;
  tool: string;
  callID: string;
  status: "completed" | "error";
  durationMs: number;
  error?: string;
  timestamp: number;
};

type SessionCreatedEvent = {
  type: "session_created";
  sessionID: string;
  parentID: string | null;
  timestamp: number;
};

type SessionErrorEvent = {
  type: "session_error";
  sessionID: string;
  errorType?: string;
  errorMessage?: string;
  timestamp: number;
};

type AgentDelegationEvent = {
  type: "agent_delegation";
  timestamp: number;
  [key: string]: unknown;
};

export type TraceEvent =
  | LlmCallEvent
  | ToolCallEvent
  | SessionCreatedEvent
  | SessionErrorEvent
  | AgentDelegationEvent;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function emptyAggregate(): Aggregate {
  return {
    llmCalls: 0,
    llmErrors: 0,
    toolCalls: 0,
    toolErrors: 0,
    tokens: { input: 0, output: 0, reasoning: 0, cacheRead: 0 },
    cost: 0,
  };
}

function getOrCreate<K, V>(map: Map<K, V>, key: K, factory: () => V): V {
  let value = map.get(key);
  if (!value) {
    value = factory();
    map.set(key, value);
  }
  return value;
}

function cloneTokens(tokens: Aggregate["tokens"]): Aggregate["tokens"] {
  return {
    input: tokens.input,
    output: tokens.output,
    reasoning: tokens.reasoning,
    cacheRead: tokens.cacheRead,
  };
}

function cloneAggregate(aggregate: Aggregate): Aggregate {
  return {
    llmCalls: aggregate.llmCalls,
    llmErrors: aggregate.llmErrors,
    toolCalls: aggregate.toolCalls,
    toolErrors: aggregate.toolErrors,
    tokens: cloneTokens(aggregate.tokens),
    cost: aggregate.cost,
  };
}

// Aggregate plus session-scoped error tracking (mirrors scripts/metrics.mts).
type SessionAggregate = Aggregate & { sessionErrors: number };

function emptySessionAggregate(): SessionAggregate {
  return { ...emptyAggregate(), sessionErrors: 0 };
}

function cloneSessionAggregate(aggregate: SessionAggregate): SessionAggregate {
  return {
    ...cloneAggregate(aggregate),
    sessionErrors: aggregate.sessionErrors,
  };
}

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
  private byModel: Map<string, Aggregate>;
  private byAgentModel: Map<string, Map<string, Aggregate>>;
  private firstSeenAt: number;
  private lastSeenAt: number;
  private readonly onSnapshot?: (snap: MetricsSnapshot) => void;

  constructor(opts?: { onSnapshot?: (snap: MetricsSnapshot) => void }) {
    this.onSnapshot = opts?.onSnapshot;
    this.totals = { ...emptyAggregate(), sessionsCreated: 0, sessionErrors: 0 };
    this.byAgent = new Map();
    this.bySession = new Map();
    this.byModel = new Map();
    this.byAgentModel = new Map();
    this.firstSeenAt = 0;
    this.lastSeenAt = 0;
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
        break;
      }

      case "tool_call": {
        this.addTool(this.totals, event);
        this.addTool(this.getSession(event.sessionID), event);
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

  snapshot(): MetricsSnapshot {
    return {
      totals: {
        ...cloneAggregate(this.totals),
        sessionsCreated: this.totals.sessionsCreated,
      },
      byAgent: Object.fromEntries(
        Array.from(this.byAgent.entries()).map(([k, v]) => [
          k,
          cloneAggregate(v),
        ]),
      ),
      bySession: Object.fromEntries(
        Array.from(this.bySession.entries()).map(([k, v]) => [
          k,
          cloneSessionAggregate(v),
        ]),
      ),
      byModel: Object.fromEntries(
        Array.from(this.byModel.entries()).map(([k, v]) => [
          k,
          cloneAggregate(v),
        ]),
      ),
      byAgentModel: Object.fromEntries(
        Array.from(this.byAgentModel.entries()).map(([agent, inner]) => [
          agent,
          Object.fromEntries(
            Array.from(inner.entries()).map(([model, agg]) => [
              model,
              cloneAggregate(agg),
            ]),
          ),
        ]),
      ),
      window: {
        firstSeenAt: this.firstSeenAt,
        lastSeenAt: this.lastSeenAt,
      },
    };
  }

  reset(): void {
    this.totals = { ...emptyAggregate(), sessionsCreated: 0, sessionErrors: 0 };
    this.byAgent = new Map();
    this.bySession = new Map();
    this.byModel = new Map();
    this.byAgentModel = new Map();
    this.firstSeenAt = 0;
    this.lastSeenAt = 0;
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
  }

  private addTool(aggregate: Aggregate, event: ToolCallEvent): void {
    aggregate.toolCalls += 1;
    if (event.status === "error") {
      aggregate.toolErrors += 1;
    }
  }

  private getAgent(agent: string): Aggregate {
    return getOrCreate(this.byAgent, agent, emptyAggregate);
  }

  private getSession(sessionID: string): SessionAggregate {
    return getOrCreate(this.bySession, sessionID, emptySessionAggregate);
  }

  private getModel(model: string): Aggregate {
    return getOrCreate(this.byModel, model, emptyAggregate);
  }

  private getAgentModel(agent: string, model: string): Aggregate {
    let inner = this.byAgentModel.get(agent);
    if (!inner) {
      inner = new Map();
      this.byAgentModel.set(agent, inner);
    }
    return getOrCreate(inner, model, emptyAggregate);
  }

  private emitSnapshot(): void {
    this.onSnapshot?.(this.snapshot());
  }
}
