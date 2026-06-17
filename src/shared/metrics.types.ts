/**
 * Shared metrics types.
 *
 * These types are the contract between the server plugin's
 * `MetricsAggregator` and the TUI plugin's `AggregatorStore`. Per
 * ADR-002, the two implementations do NOT share runtime code — each
 * ingests events from its own source (OpenCode SDK events vs JSONL
 * trace events). They do share this shape so consumers (TUI
 * components, formatters) can render either snapshot without
 * knowing its origin.
 *
 * If a new field is needed by both implementations, add it here.
 * Internal helpers (e.g. `LlmAssistantMessage`) live in the
 * server's private types.
 */
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
  workDurationMs: number;
};

export type MetricsSnapshot = {
  totals: Aggregate & { sessionsCreated: number; sessionErrors?: number };
  bySession: Record<string, Aggregate>;
  byAgent: Record<string, Aggregate>;
  byModel: Record<string, Aggregate>;
  byAgentModel: Record<string, Record<string, Aggregate>>;
  window: { firstSeenAt: number; lastSeenAt: number };
  lastActiveAgent: { name: string; timestamp: number } | null;
};
