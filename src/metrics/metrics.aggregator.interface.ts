import type { AssistantMessage } from "@opencode-ai/sdk";

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

export type LlmAssistantMessage = Omit<AssistantMessage, "tokens"> & {
  tokens?: AssistantMessage["tokens"] | null;
  cost?: number;
};
