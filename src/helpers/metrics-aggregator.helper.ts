import type {
  Aggregate,
  TokenUsage,
} from "../metrics/metrics.aggregator.interface";

export const emptyAggregate = (): Aggregate => ({
  llmCalls: 0,
  llmErrors: 0,
  toolCalls: 0,
  toolErrors: 0,
  tokens: { input: 0, output: 0, reasoning: 0, cacheRead: 0 },
  cost: 0,
});

export const addTokens = (target: TokenUsage, source: TokenUsage): void => {
  target.input += source.input;
  target.output += source.output;
  target.reasoning += source.reasoning;
  target.cacheRead += source.cacheRead;
};

export const addToAggregate = (target: Aggregate, source: Aggregate): void => {
  target.llmCalls += source.llmCalls;
  target.llmErrors += source.llmErrors;
  target.toolCalls += source.toolCalls;
  target.toolErrors += source.toolErrors;
  target.cost += source.cost;
  addTokens(target.tokens, source.tokens);
};

export const mapToRecord = (
  map: Map<string, Aggregate>,
): Record<string, Aggregate> => {
  const record: Record<string, Aggregate> = {};
  for (const [key, value] of map) {
    record[key] = cloneAggregate(value);
  }
  return record;
};

export const cloneAggregate = (agg: Aggregate): Aggregate => ({
  llmCalls: agg.llmCalls,
  llmErrors: agg.llmErrors,
  toolCalls: agg.toolCalls,
  toolErrors: agg.toolErrors,
  tokens: { ...agg.tokens },
  cost: agg.cost,
});

export const cloneAggregateWithSessions = (
  agg: Aggregate & { sessionsCreated: number },
): Aggregate & { sessionsCreated: number } => ({
  ...cloneAggregate(agg),
  sessionsCreated: agg.sessionsCreated,
});
