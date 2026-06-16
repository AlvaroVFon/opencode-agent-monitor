import type {
  Aggregate,
  TokenUsage,
} from "../metrics/metrics.aggregator.interface";

export class MetricsAggregatorHelper {
  emptyAggregate(): Aggregate {
    return {
      llmCalls: 0,
      llmErrors: 0,
      toolCalls: 0,
      toolErrors: 0,
      tokens: { input: 0, output: 0, reasoning: 0, cacheRead: 0 },
      cost: 0,
    };
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
    target.cost += source.cost;
    this.addTokens(target.tokens, source.tokens);
  }

  cloneAggregate(agg: Aggregate): Aggregate {
    return {
      llmCalls: agg.llmCalls,
      llmErrors: agg.llmErrors,
      toolCalls: agg.toolCalls,
      toolErrors: agg.toolErrors,
      tokens: { ...agg.tokens },
      cost: agg.cost,
    };
  }

  cloneAggregateWithSessions(
    agg: Aggregate & { sessionsCreated: number },
  ): Aggregate & { sessionsCreated: number } {
    return {
      ...this.cloneAggregate(agg),
      sessionsCreated: agg.sessionsCreated,
    };
  }

  mapToRecord(map: Map<string, Aggregate>): Record<string, Aggregate> {
    const record: Record<string, Aggregate> = {};
    for (const [key, value] of map) {
      record[key] = this.cloneAggregate(value);
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
}
