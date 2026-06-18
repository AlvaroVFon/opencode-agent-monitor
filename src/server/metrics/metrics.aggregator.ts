import { EventType, PartStatus, PartType, Role, UNKNOWN } from "../enums";
import type {
  MessagePartUpdatedProps,
  MessageUpdatedProps,
  SessionCreatedProps,
  SessionErrorProps,
} from "../types";
import { AggregateHelper } from "../../shared/aggregate.helpers";
import { SnapshotFilterHelper } from "../helpers/snapshot-filter.helper";
import { SnapshotTransformHelper } from "../helpers/snapshot-transform.helper";
import type { LlmAssistantMessage } from "./messages.types";
import type {
  Aggregate,
  ErrorEntry,
  MetricsSnapshot,
  TokenUsage,
  ToolStats,
} from "../../shared/metrics.types";

export class MetricsAggregator {
  private readonly totals: Aggregate & {
    sessionsCreated: number;
    sessionErrors: number;
  };
  private readonly bySession = new Map<string, Aggregate>();
  private readonly byAgent = new Map<string, Aggregate>();
  private readonly byModel = new Map<string, Aggregate>();
  private readonly byAgentModel = new Map<string, Map<string, Aggregate>>();
  private readonly byTool = new Map<string, ToolStats>();
  private readonly errors: ErrorEntry[] = [];
  private firstSeenAt = 0;
  private lastSeenAt = 0;

  constructor(
    private readonly currentAgent: Map<string, string>,
    private readonly helper: AggregateHelper,
    private readonly filterHelper: SnapshotFilterHelper = new SnapshotFilterHelper(
      new SnapshotTransformHelper(new AggregateHelper()),
    ),
  ) {
    this.totals = {
      ...this.helper.empty(),
      sessionsCreated: 0,
      sessionErrors: 0,
    };
  }

  ingest(event: { type: string; properties: unknown }): void {
    this.touchWindow(Date.now());

    switch (event.type) {
      case EventType.MESSAGE_UPDATED:
        this.ingestMessage(event.properties as MessageUpdatedProps);
        break;
      case EventType.MESSAGE_PART_UPDATED:
        this.ingestPart(event.properties as MessagePartUpdatedProps);
        break;
      case EventType.SESSION_CREATED:
        this.ingestSessionCreated(event.properties as SessionCreatedProps);
        break;
      case EventType.SESSION_ERROR:
        this.ingestSessionError(event.properties as SessionErrorProps);
        break;
    }
  }

  snapshot(opts?: {
    since?: number;
    groupBy?: "agent" | "model" | "session" | "tool";
    sessionID?: string;
    top?: number;
  }): MetricsSnapshot {
    const base = this.buildBaseSnapshot();

    if (opts?.since) {
      const filtered = this.filterHelper.since(base, opts.since);
      if (filtered) return filtered;
    }

    if (opts?.sessionID) {
      return this.filterHelper.sessionID(base, opts.sessionID);
    }

    if (opts?.groupBy) {
      return this.filterHelper.groupBy(base, opts.groupBy);
    }

    if (opts?.top && opts.top > 0) {
      return this.filterHelper.top(base, opts.top);
    }

    return base;
  }

  private buildBaseSnapshot(): MetricsSnapshot {
    return {
      totals: {
        ...this.helper.clone(this.totals),
        sessionsCreated: this.totals.sessionsCreated,
        sessionErrors: this.totals.sessionErrors,
      },
      bySession: this.helper.mapToRecord(this.bySession),
      byAgent: this.helper.mapToRecord(this.byAgent),
      byModel: this.helper.mapToRecord(this.byModel),
      byAgentModel: this.helper.mapToNestedRecord(this.byAgentModel),
      byTool: this.helper.mapToToolStatsRecord(this.byTool),
      errors: this.errors.map((e) => ({ ...e })),
      window: { firstSeenAt: this.firstSeenAt, lastSeenAt: this.lastSeenAt },
      lastActiveAgent: null,
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
    this.totals.sessionErrors = 0;
    this.bySession.clear();
    this.byAgent.clear();
    this.byModel.clear();
    this.byAgentModel.clear();
    this.byTool.clear();
    this.errors.length = 0;
    this.firstSeenAt = 0;
    this.lastSeenAt = 0;
  }

  ingestMessage(props: MessageUpdatedProps): void {
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

  ingestPart(props: MessagePartUpdatedProps): void {
    const part = props.part as {
      type?: string;
      sessionID?: string;
      tool?: string;
      state?: {
        status?: string;
        time?: { start?: number; end?: number };
        error?: unknown;
      };
    };

    if (part.type !== PartType.TOOL) return;
    if (!part.sessionID) return;

    const status = part.state?.status;
    if (status !== PartStatus.COMPLETED && status !== PartStatus.ERROR) return;

    const sessionID = part.sessionID;
    const agent = this.currentAgent.get(sessionID) ?? UNKNOWN;
    const toolName = part.tool ?? UNKNOWN;
    const durationMs =
      part.state?.time?.start && part.state?.time?.end
        ? part.state.time.end - part.state.time.start
        : 0;

    this.recordToolCall(
      sessionID,
      agent,
      toolName,
      status === PartStatus.ERROR,
      durationMs,
    );

    if (status === PartStatus.ERROR) {
      this.pushError({
        sessionID,
        type: "tool_error",
        message: String(part.state?.error ?? ""),
        timestamp: Date.now(),
      });
    }
  }

  ingestSessionCreated(props: SessionCreatedProps): void {
    const sessionID = (props as { info?: { id?: string } }).info?.id;
    if (!sessionID) return;

    this.totals.sessionsCreated += 1;
    this.ensureAggregate(this.bySession, sessionID);
  }

  ingestSessionError(props: SessionErrorProps): void {
    const sessionID =
      props.sessionID ?? (props as { info?: { id?: string } }).info?.id;
    if (!sessionID) return;

    this.totals.sessionErrors += 1;

    this.pushError({
      sessionID,
      type: props.error?.name ?? "session_error",
      message: String(props.error?.data ?? ""),
      timestamp: Date.now(),
    });
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
      workDurationMs: 0,
    };

    this.helper.addToAggregate(this.totals, inc);
    this.helper.addToAggregate(
      this.ensureAggregate(this.bySession, sessionID),
      inc,
    );
    this.helper.addToAggregate(this.ensureAggregate(this.byAgent, agent), inc);
    this.helper.addToAggregate(this.ensureAggregate(this.byModel, model), inc);
    this.helper.addToAggregate(
      this.ensureNestedAggregate(this.byAgentModel, agent, model),
      inc,
    );
  }

  private recordLlmError(
    sessionID: string,
    agent: string,
    model: string,
  ): void {
    const inc: Aggregate = {
      ...this.helper.empty(),
      llmErrors: 1,
    };

    this.helper.addToAggregate(this.totals, inc);
    this.helper.addToAggregate(
      this.ensureAggregate(this.bySession, sessionID),
      inc,
    );
    this.helper.addToAggregate(this.ensureAggregate(this.byAgent, agent), inc);
    this.helper.addToAggregate(this.ensureAggregate(this.byModel, model), inc);
    this.helper.addToAggregate(
      this.ensureNestedAggregate(this.byAgentModel, agent, model),
      inc,
    );

    this.pushError({
      sessionID,
      type: "llm_error",
      message: "",
      timestamp: Date.now(),
    });
  }

  private recordToolCall(
    sessionID: string,
    agent: string,
    toolName: string,
    isError: boolean,
    durationMs: number,
  ): void {
    const inc: Aggregate = {
      ...this.helper.empty(),
      toolCalls: 1,
      toolErrors: isError ? 1 : 0,
    };

    this.helper.addToAggregate(this.totals, inc);
    this.helper.addToAggregate(
      this.ensureAggregate(this.bySession, sessionID),
      inc,
    );
    this.helper.addToAggregate(this.ensureAggregate(this.byAgent, agent), inc);

    const toolInc: ToolStats = {
      calls: 1,
      errors: isError ? 1 : 0,
      durationMs,
    };
    this.helper.addToToolStats(
      this.ensureToolStats(this.byTool, toolName),
      toolInc,
    );
  }

  private ensureAggregate(map: Map<string, Aggregate>, key: string): Aggregate {
    let bucket = map.get(key);
    if (!bucket) {
      bucket = this.helper.empty();
      map.set(key, bucket);
    }
    return bucket;
  }

  private ensureNestedAggregate(
    map: Map<string, Map<string, Aggregate>>,
    outerKey: string,
    innerKey: string,
  ): Aggregate {
    let inner = map.get(outerKey);
    if (!inner) {
      inner = new Map();
      map.set(outerKey, inner);
    }
    let bucket = inner.get(innerKey);
    if (!bucket) {
      bucket = this.helper.empty();
      inner.set(innerKey, bucket);
    }
    return bucket;
  }

  private ensureToolStats(map: Map<string, ToolStats>, key: string): ToolStats {
    let bucket = map.get(key);
    if (!bucket) {
      bucket = this.helper.emptyToolStats();
      map.set(key, bucket);
    }
    return bucket;
  }

  private pushError(entry: ErrorEntry): void {
    if (this.errors.length >= 1000) {
      this.errors.shift();
    }
    this.errors.push(entry);
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
