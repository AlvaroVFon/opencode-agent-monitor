import type {
  Aggregate,
  TokenUsage,
  ToolStats,
  SkillStats,
} from "./metrics.types";

export type SessionAggregate = Aggregate & { sessionErrors: number };

export class AggregateHelper {
  empty(): Aggregate {
    return {
      llmCalls: 0,
      llmErrors: 0,
      toolCalls: 0,
      toolErrors: 0,
      skillCalls: 0,
      skillErrors: 0,
      tokens: { input: 0, output: 0, reasoning: 0, cacheRead: 0 },
      cost: 0,
      workDurationMs: 0,
    };
  }

  emptyToolStats(): ToolStats {
    return { calls: 0, errors: 0, durationMs: 0 };
  }

  emptySkillStats(): SkillStats {
    return { calls: 0, errors: 0, avgDurationMs: 0 };
  }

  emptySession(): SessionAggregate {
    return { ...this.empty(), sessionErrors: 0 };
  }

  getOrCreate<K, V>(map: Map<K, V>, key: K, factory: () => V): V {
    let value = map.get(key);
    if (!value) {
      value = factory();
      map.set(key, value);
    }
    return value;
  }

  addTokens(target: TokenUsage, source: TokenUsage): void {
    target.input += source.input;
    target.output += source.output;
    target.reasoning += source.reasoning;
    target.cacheRead += source.cacheRead;
  }

  addToAggregate(target: Aggregate, source: Aggregate): void {
    target.llmCalls += source.llmCalls;
    target.llmErrors += source.llmErrors;
    target.toolCalls += source.toolCalls;
    target.toolErrors += source.toolErrors;
    target.skillCalls += source.skillCalls;
    target.skillErrors += source.skillErrors;
    target.cost += source.cost;
    target.workDurationMs += source.workDurationMs;
    this.addTokens(target.tokens, source.tokens);
  }

  addToToolStats(target: ToolStats, source: ToolStats): void {
    target.calls += source.calls;
    target.errors += source.errors;
    target.durationMs += source.durationMs;
  }

  addToSkillStats(target: SkillStats, source: SkillStats): void {
    const totalCalls = target.calls + source.calls;
    const totalDurationMs =
      target.avgDurationMs * target.calls + source.avgDurationMs * source.calls;
    target.calls += source.calls;
    target.errors += source.errors;
    target.avgDurationMs = totalCalls > 0 ? totalDurationMs / totalCalls : 0;
  }

  clone(aggregate: Aggregate): Aggregate {
    return {
      llmCalls: aggregate.llmCalls,
      llmErrors: aggregate.llmErrors,
      toolCalls: aggregate.toolCalls,
      toolErrors: aggregate.toolErrors,
      skillCalls: aggregate.skillCalls,
      skillErrors: aggregate.skillErrors,
      tokens: { ...aggregate.tokens },
      cost: aggregate.cost,
      workDurationMs: aggregate.workDurationMs,
    };
  }

  cloneSession(aggregate: SessionAggregate): SessionAggregate {
    return { ...this.clone(aggregate), sessionErrors: aggregate.sessionErrors };
  }

  mapToRecord(map: Map<string, Aggregate>): Record<string, Aggregate> {
    const record: Record<string, Aggregate> = {};
    for (const [key, value] of map) {
      record[key] = this.clone(value);
    }
    return record;
  }

  mapToNestedRecord(
    map: Map<string, Map<string, Aggregate>>,
  ): Record<string, Record<string, Aggregate>> {
    const record: Record<string, Record<string, Aggregate>> = {};
    for (const [key, inner] of map) {
      record[key] = this.mapToRecord(inner);
    }
    return record;
  }

  mapToToolStatsRecord(map: Map<string, ToolStats>): Record<string, ToolStats> {
    const record: Record<string, ToolStats> = {};
    for (const [key, value] of map) {
      record[key] = { ...value };
    }
    return record;
  }

  mapToSkillStatsRecord(
    map: Map<string, SkillStats>,
  ): Record<string, SkillStats> {
    const record: Record<string, SkillStats> = {};
    for (const [key, value] of map) {
      record[key] = { ...value };
    }
    return record;
  }
}

export const aggregateHelper = new AggregateHelper();
