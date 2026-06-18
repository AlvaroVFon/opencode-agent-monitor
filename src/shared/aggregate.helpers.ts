import type { Aggregate, ToolStats } from "./metrics.types";

export function emptyAggregate(): Aggregate {
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

export function emptyToolStats(): ToolStats {
  return { calls: 0, errors: 0, durationMs: 0 };
}

export function getOrCreateMapEntry<K, V>(
  map: Map<K, V>,
  key: K,
  factory: () => V,
): V {
  let value = map.get(key);
  if (!value) {
    value = factory();
    map.set(key, value);
  }
  return value;
}

export function addToAggregate(target: Aggregate, source: Aggregate): void {
  target.llmCalls += source.llmCalls;
  target.llmErrors += source.llmErrors;
  target.toolCalls += source.toolCalls;
  target.toolErrors += source.toolErrors;
  target.cost += source.cost;
  target.tokens.input += source.tokens.input;
  target.tokens.output += source.tokens.output;
  target.tokens.reasoning += source.tokens.reasoning;
  target.tokens.cacheRead += source.tokens.cacheRead;
}

export function cloneAggregate(aggregate: Aggregate): Aggregate {
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
