import type { Aggregate } from "../../shared/metrics.types";

export type SessionAggregate = Aggregate & { sessionErrors: number };

export class AggregateHelper {
  empty(): Aggregate {
    return {
      llmCalls: 0,
      llmErrors: 0,
      toolCalls: 0,
      toolErrors: 0,
      tokens: { input: 0, output: 0, reasoning: 0, cacheRead: 0 },
      cost: 0,
      workDurationMs: 0,
    };
  }

  clone(aggregate: Aggregate): Aggregate {
    return {
      llmCalls: aggregate.llmCalls,
      llmErrors: aggregate.llmErrors,
      toolCalls: aggregate.toolCalls,
      toolErrors: aggregate.toolErrors,
      tokens: { ...aggregate.tokens },
      cost: aggregate.cost,
      workDurationMs: aggregate.workDurationMs,
    };
  }

  emptySession(): SessionAggregate {
    return { ...this.empty(), sessionErrors: 0 };
  }

  cloneSession(aggregate: SessionAggregate): SessionAggregate {
    return {
      ...this.clone(aggregate),
      sessionErrors: aggregate.sessionErrors,
    };
  }

  getOrCreate<K, V>(map: Map<K, V>, key: K, factory: () => V): V {
    let value = map.get(key);
    if (!value) {
      value = factory();
      map.set(key, value);
    }
    return value;
  }
}

export const aggregateHelper = new AggregateHelper();
