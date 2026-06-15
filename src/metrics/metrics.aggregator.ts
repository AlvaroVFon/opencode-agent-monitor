import { EventType, PartStatus, PartType, Role, UNKNOWN } from "../enums";
import type {
  MessagePartUpdatedProps,
  MessageUpdatedProps,
  SessionCreatedProps,
} from "../types";
import { MetricsAggregatorHelper } from "../helpers/metrics-aggregator.helper";
import { MetricsHandlersRegistry } from "./metrics.aggregator.registry";
import type {
  Aggregate,
  LlmAssistantMessage,
  MetricsSnapshot,
  TokenUsage,
} from "./metrics.aggregator.interface";

export class MetricsAggregator {
  private readonly helper = new MetricsAggregatorHelper();
  private readonly totals: Aggregate & { sessionsCreated: number } = {
    ...this.helper.emptyAggregate(),
    sessionsCreated: 0,
  };
  private readonly bySession = new Map<string, Aggregate>();
  private readonly byAgent = new Map<string, Aggregate>();
  private readonly byModel = new Map<string, Aggregate>();
  private firstSeenAt = 0;
  private lastSeenAt = 0;
  private readonly registry: MetricsHandlersRegistry;

  constructor(private readonly currentAgent: Map<string, string>) {
    this.registry = new MetricsHandlersRegistry()
      .register(EventType.MESSAGE_UPDATED, (properties) =>
        this.ingestMessage(properties as MessageUpdatedProps),
      )
      .register(EventType.MESSAGE_PART_UPDATED, (properties) =>
        this.ingestPart(properties as MessagePartUpdatedProps),
      )
      .register(EventType.SESSION_CREATED, (properties) =>
        this.ingestSessionCreated(properties as SessionCreatedProps),
      );
  }

  ingest(event: { type: string; properties: unknown }): void {
    this.touchWindow(Date.now());
    this.registry.dispatch(event);
  }

  snapshot(): MetricsSnapshot {
    return {
      totals: this.helper.cloneAggregateWithSessions(this.totals),
      bySession: this.helper.mapToRecord(this.bySession),
      byAgent: this.helper.mapToRecord(this.byAgent),
      byModel: this.helper.mapToRecord(this.byModel),
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
    const msg = props.info as LlmAssistantMessage;

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
        cost: msg.cost ?? 0,
      });
    }
  }

  private ingestPart(props: MessagePartUpdatedProps): void {
    const part = props.part as {
      type?: string;
      sessionID?: string;
      state?: { status?: string };
    };

    if (part.type !== PartType.TOOL) return;
    if (!part.sessionID) return;

    const status = part.state?.status;
    if (status !== PartStatus.COMPLETED && status !== PartStatus.ERROR) return;

    const sessionID = part.sessionID;
    const agent = this.currentAgent.get(sessionID) ?? UNKNOWN;

    this.recordToolCall(sessionID, agent, status === PartStatus.ERROR);
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

    this.helper.addToAggregate(this.totals, inc);
    this.helper.addToAggregate(
      this.ensureAggregate(this.bySession, sessionID),
      inc,
    );
    this.helper.addToAggregate(this.ensureAggregate(this.byAgent, agent), inc);
    this.helper.addToAggregate(this.ensureAggregate(this.byModel, model), inc);
  }

  private recordLlmError(
    sessionID: string,
    agent: string,
    model: string,
  ): void {
    const inc: Aggregate = {
      ...this.helper.emptyAggregate(),
      llmErrors: 1,
    };

    this.helper.addToAggregate(this.totals, inc);
    this.helper.addToAggregate(
      this.ensureAggregate(this.bySession, sessionID),
      inc,
    );
    this.helper.addToAggregate(this.ensureAggregate(this.byAgent, agent), inc);
    this.helper.addToAggregate(this.ensureAggregate(this.byModel, model), inc);
  }

  private recordToolCall(
    sessionID: string,
    agent: string,
    isError: boolean,
  ): void {
    const inc: Aggregate = {
      ...this.helper.emptyAggregate(),
      toolCalls: 1,
      toolErrors: isError ? 1 : 0,
    };

    this.helper.addToAggregate(this.totals, inc);
    this.helper.addToAggregate(
      this.ensureAggregate(this.bySession, sessionID),
      inc,
    );
    this.helper.addToAggregate(this.ensureAggregate(this.byAgent, agent), inc);
  }

  private ensureAggregate(map: Map<string, Aggregate>, key: string): Aggregate {
    let bucket = map.get(key);
    if (!bucket) {
      bucket = this.helper.emptyAggregate();
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
