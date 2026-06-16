import type { AssistantMessage } from "@opencode-ai/sdk";

/**
 * Internal helper type used by `MetricsAggregator` to type the lax
 * `info` payload of a `message.updated` event. The shape is relaxed
 * because error messages arrive without `tokens` set, and we want
 * the type system to reflect that explicitly.
 *
 * This type is private to the server plugin — the TUI does not
 * consume it (the TUI ingests from JSONL with a different shape,
 * defined inline in `tui/aggregator-store.ts`).
 */
export type LlmAssistantMessage = Omit<AssistantMessage, "tokens"> & {
  tokens?: AssistantMessage["tokens"] | null;
  cost?: number;
};
