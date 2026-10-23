/**
 * Shared metrics types.
 *
 * These types are the contract between the JSONL trace events and the
 * consumers that render metrics (the TUI's `AggregatorStore`, the CLI's
 * `EventAggregatorHelper`, and the HTML dashboard). The TUI and CLI ingest
 * different inputs but share this shape so components and formatters can
 * render either snapshot without knowing its origin.
 *
 * If a new field is needed by several consumers, add it here.
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
  skillCalls: number;
  skillErrors: number;
  tokens: TokenUsage;
  cost: number;
  workDurationMs: number;
};

export type ToolStats = {
  calls: number;
  errors: number;
  durationMs: number;
};

export type SkillStats = {
  calls: number;
  errors: number;
  avgDurationMs: number;
};

export type ErrorEntry = {
  sessionID: string;
  type: string;
  message: string;
  timestamp: number;
};

export type MetricsSnapshot = {
  totals: Aggregate & { sessionsCreated: number; sessionErrors: number };
  bySession: Record<string, Aggregate>;
  byAgent: Record<string, Aggregate>;
  byModel: Record<string, Aggregate>;
  byAgentModel: Record<string, Record<string, Aggregate>>;
  byTool: Record<string, ToolStats>;
  bySkill: Record<string, SkillStats>;
  errors: ErrorEntry[];
  window: { firstSeenAt: number; lastSeenAt: number };
  lastActiveAgent: { name: string; timestamp: number } | null;
};
