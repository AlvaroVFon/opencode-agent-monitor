import type { GetAgent } from "../handler.interface";
import { AggregateHelper } from "../../shared/aggregate.helpers";
import { SnapshotFilterHelper } from "../helpers/snapshot-filter.helper";
import { SnapshotTransformHelper } from "../helpers/snapshot-transform.helper";
import type {
  Aggregate,
  ErrorEntry,
  MetricsSnapshot,
  SkillStats,
  TokenUsage,
  ToolStats,
} from "../../shared/metrics.types";
import type { MetricsRecorder } from "./metrics-handler.interface";
import { MetricsHandlersRegistry } from "./metrics.handler-map";

export class MetricsAggregator implements MetricsRecorder {
  private readonly totals: Aggregate & {
    sessionsCreated: number;
    sessionErrors: number;
  };
  private readonly bySession = new Map<string, Aggregate>();
  private readonly byAgent = new Map<string, Aggregate>();
  private readonly byModel = new Map<string, Aggregate>();
  private readonly byAgentModel = new Map<string, Map<string, Aggregate>>();
  private readonly byTool = new Map<string, ToolStats>();
  private readonly bySkill = new Map<string, SkillStats>();
  private readonly errors: ErrorEntry[] = [];
  private firstSeenAt = 0;
  private lastSeenAt = 0;

  constructor(
    private readonly helper: AggregateHelper,
    private readonly filterHelper: SnapshotFilterHelper = new SnapshotFilterHelper(
      new SnapshotTransformHelper(new AggregateHelper()),
    ),
    private readonly registry: MetricsHandlersRegistry = new MetricsHandlersRegistry(),
  ) {
    this.totals = {
      ...this.helper.empty(),
      sessionsCreated: 0,
      sessionErrors: 0,
    };
  }

  ingest(
    event: { type: string; properties: unknown },
    getAgent?: GetAgent,
  ): void {
    this.touchWindow(Date.now());
    for (const handler of this.registry.get(event.type)) {
      handler.handle(event.properties, this, getAgent);
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
      bySkill: this.helper.mapToSkillStatsRecord(this.bySkill),
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
    this.totals.skillCalls = 0;
    this.totals.skillErrors = 0;
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
    this.bySkill.clear();
    this.errors.length = 0;
    this.firstSeenAt = 0;
    this.lastSeenAt = 0;
  }

  recordSessionCreated(sessionID: string): void {
    this.totals.sessionsCreated += 1;
    this.ensureAggregate(this.bySession, sessionID);
  }

  recordSessionError(sessionID: string, type: string, message: string): void {
    this.totals.sessionErrors += 1;
    this.pushError({ sessionID, type, message, timestamp: Date.now() });
  }

  recordLlmCall(
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
      skillCalls: 0,
      skillErrors: 0,
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

  recordLlmError(sessionID: string, agent: string, model: string): void {
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

  recordToolCall(
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

  recordSkillCall(
    sessionID: string,
    skill: string,
    isError: boolean,
    durationMs: number,
  ): void {
    const inc: Aggregate = {
      ...this.helper.empty(),
      skillCalls: 1,
      skillErrors: isError ? 1 : 0,
    };

    this.helper.addToAggregate(this.totals, inc);

    const skillInc: SkillStats = {
      calls: 1,
      errors: isError ? 1 : 0,
      avgDurationMs: durationMs,
    };
    this.helper.addToSkillStats(
      this.ensureSkillStats(this.bySkill, skill),
      skillInc,
    );
  }

  private ensureSkillStats(
    map: Map<string, SkillStats>,
    key: string,
  ): SkillStats {
    let bucket = map.get(key);
    if (!bucket) {
      bucket = this.helper.emptySkillStats();
      map.set(key, bucket);
    }
    return bucket;
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

  pushError(entry: ErrorEntry): void {
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
