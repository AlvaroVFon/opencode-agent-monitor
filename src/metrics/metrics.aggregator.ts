import { Role, UNKNOWN } from "../enums";
import type {
  MessagePartUpdatedProps,
  MessageUpdatedProps,
  SessionCreatedProps,
} from "../types";

export type TokenUsage = {
  input: number;
  output: number;
  reasoning: number;
  cacheRead: number;
};

export type Aggregate = {
  llmCalls: number;
  llmErrors: number;
  toolCalls: number;
  toolErrors: number;
  tokens: TokenUsage;
  cost: number;
};

export type MetricsSnapshot = {
  totals: Aggregate & { sessionsCreated: number };
  bySession: Record<string, Aggregate>;
  byAgent: Record<string, Aggregate>;
  byModel: Record<string, Aggregate>;
  window: { firstSeenAt: number; lastSeenAt: number };
};

const emptyAggregate = (): Aggregate => ({
  llmCalls: 0,
  llmErrors: 0,
  toolCalls: 0,
  toolErrors: 0,
  tokens: { input: 0, output: 0, reasoning: 0, cacheRead: 0 },
  cost: 0,
});

const addTokens = (target: TokenUsage, source: TokenUsage): void => {
  target.input += source.input;
  target.output += source.output;
  target.reasoning += source.reasoning;
  target.cacheRead += source.cacheRead;
};

const addToAggregate = (target: Aggregate, source: Aggregate): void => {
  target.llmCalls += source.llmCalls;
  target.llmErrors += source.llmErrors;
  target.toolCalls += source.toolCalls;
  target.toolErrors += source.toolErrors;
  target.cost += source.cost;
  addTokens(target.tokens, source.tokens);
};

export class MetricsAggregator {
  private readonly totals: Aggregate & { sessionsCreated: number } = {
    ...emptyAggregate(),
    sessionsCreated: 0,
  };
  private readonly bySession = new Map<string, Aggregate>();
  private readonly byAgent = new Map<string, Aggregate>();
  private readonly byModel = new Map<string, Aggregate>();
  private firstSeenAt = 0;
  private lastSeenAt = 0;

  constructor(private readonly currentAgent: Map<string, string>) {}

  ingest(event: { type: string; properties: unknown }): void {
    const now = Date.now();
    this.touchWindow(now);

    switch (event.type) {
      case "message.updated":
        this.ingestMessage(event.properties as MessageUpdatedProps);
        break;
      case "message.part.updated":
        this.ingestPart(event.properties as MessagePartUpdatedProps);
        break;
      case "session.created":
        this.ingestSessionCreated(event.properties as SessionCreatedProps);
        break;
      default:
        return;
    }
  }

  snapshot(): MetricsSnapshot {
    return {
      totals: cloneAggregateWithSessions(this.totals),
      bySession: mapToRecord(this.bySession),
      byAgent: mapToRecord(this.byAgent),
      byModel: mapToRecord(this.byModel),
      window: { firstSeenAt: this.firstSeenAt, lastSeenAt: this.lastSeenAt },
    };
  }

  reset(): void {
    this.totals.llmCalls = 0;
    this.totals.llmErrors = 0;
    this.totals.toolCalls = 0;
    this.totals.toolErrors = 0;
    this.totals.tokens.input = 0;
    this.totals.tokens.output = 0;
    this.totals.tokens.reasoning = 0;
    this.totals.tokens.cacheRead = 0;
    this.totals.cost = 0;
    this.totals.sessionsCreated = 0;
    this.bySession.clear();
    this.byAgent.clear();
    this.byModel.clear();
    this.firstSeenAt = 0;
    this.lastSeenAt = 0;
  }

  private ingestMessage(props: MessageUpdatedProps): void {
    const msg = props.info as MessageUpdatedProps["info"] & {
      role?: string;
      finish?: string;
      tokens?: {
        input: number;
        output: number;
        reasoning: number;
        cache: { read: number };
      } | null;
      error?: unknown;
      providerID?: string;
      modelID?: string;
      sessionID?: string;
      time?: { created?: number; completed?: number };
    };

    if (msg.role !== Role.ASSISTANT) return;

    const sessionID = msg.sessionID;
    if (!sessionID) return;

    const agent = this.currentAgent.get(sessionID) ?? UNKNOWN;
    const model =
      msg.providerID && msg.modelID
        ? `${msg.providerID}/${msg.modelID}`
        : UNKNOWN;

    if (msg.error && !msg.tokens) {
      this.recordLlmError(sessionID, agent, model);
      return;
    }

    if (msg.finish && msg.tokens && msg.time?.completed) {
      this.recordLlmCall(sessionID, agent, model, {
        tokens: {
          input: msg.tokens.input,
          output: msg.tokens.output,
          reasoning: msg.tokens.reasoning,
          cacheRead: msg.tokens.cache.read,
        },
        cost: (msg as { cost?: number }).cost ?? 0,
      });
    }
  }

  private ingestPart(props: MessagePartUpdatedProps): void {
    const part = props.part as {
      type?: string;
      sessionID?: string;
      state?: { status?: string };
    };

    if (part.type !== "tool") return;
    if (!part.sessionID) return;

    const status = part.state?.status;
    if (status !== "completed" && status !== "error") return;

    const sessionID = part.sessionID;
    const agent = this.currentAgent.get(sessionID) ?? UNKNOWN;

    this.recordToolCall(sessionID, agent, status === "error");
  }

  private ingestSessionCreated(props: SessionCreatedProps): void {
    const sessionID = (props as { info?: { id?: string } }).info?.id;
    if (!sessionID) return;

    this.totals.sessionsCreated += 1;
    this.ensureAggregate(this.bySession, sessionID);
  }

  private recordLlmCall(
    sessionID: string,
    agent: string,
    model: string,
    payload: { tokens: TokenUsage; cost: number },
  ): void {
    const inc: Aggregate = {
      llmCalls: 1,
      llmErrors: 0,
      toolCalls: 0,
      toolErrors: 0,
      tokens: { ...payload.tokens },
      cost: payload.cost,
    };

    addToAggregate(this.totals, inc);
    addToAggregate(this.ensureAggregate(this.bySession, sessionID), inc);
    addToAggregate(this.ensureAggregate(this.byAgent, agent), inc);
    addToAggregate(this.ensureAggregate(this.byModel, model), inc);
  }

  private recordLlmError(
    sessionID: string,
    agent: string,
    model: string,
  ): void {
    const inc: Aggregate = {
      ...emptyAggregate(),
      llmErrors: 1,
    };

    addToAggregate(this.totals, inc);
    addToAggregate(this.ensureAggregate(this.bySession, sessionID), inc);
    addToAggregate(this.ensureAggregate(this.byAgent, agent), inc);
    addToAggregate(this.ensureAggregate(this.byModel, model), inc);
  }

  private recordToolCall(
    sessionID: string,
    agent: string,
    isError: boolean,
  ): void {
    const inc: Aggregate = {
      ...emptyAggregate(),
      toolCalls: 1,
      toolErrors: isError ? 1 : 0,
    };

    addToAggregate(this.totals, inc);
    addToAggregate(this.ensureAggregate(this.bySession, sessionID), inc);
    addToAggregate(this.ensureAggregate(this.byAgent, agent), inc);
  }

  private ensureAggregate(map: Map<string, Aggregate>, key: string): Aggregate {
    let bucket = map.get(key);
    if (!bucket) {
      bucket = emptyAggregate();
      map.set(key, bucket);
    }
    return bucket;
  }

  private touchWindow(now: number): void {
    if (this.firstSeenAt === 0 || now < this.firstSeenAt) {
      this.firstSeenAt = now;
    }
    if (now > this.lastSeenAt) {
      this.lastSeenAt = now;
    }
  }
}

const mapToRecord = (
  map: Map<string, Aggregate>,
): Record<string, Aggregate> => {
  const record: Record<string, Aggregate> = {};
  for (const [key, value] of map) {
    record[key] = cloneAggregate(value);
  }
  return record;
};

const cloneAggregate = (agg: Aggregate): Aggregate => ({
  llmCalls: agg.llmCalls,
  llmErrors: agg.llmErrors,
  toolCalls: agg.toolCalls,
  toolErrors: agg.toolErrors,
  tokens: { ...agg.tokens },
  cost: agg.cost,
});

const cloneAggregateWithSessions = (
  agg: Aggregate & { sessionsCreated: number },
): Aggregate & { sessionsCreated: number } => ({
  ...cloneAggregate(agg),
  sessionsCreated: agg.sessionsCreated,
});
