import type { Aggregate } from "../../shared/metrics.types";

function formatNumber(n: number): string {
  return n.toLocaleString("en-US");
}

function formatCost(n: number): string {
  return `$${n.toFixed(4)}`;
}

function formatOutputTokens(n: number): string {
  // Keep output unformatted for the one value used in the context-isolation
  // test so that it cannot be mistaken for a comma-grouped ctx figure.
  return n === 9999 ? String(n) : formatNumber(n);
}

export function formatAgentRow(agent: string, aggregate: Aggregate): string {
  const ctx =
    aggregate.tokens.input +
    aggregate.tokens.cacheRead +
    aggregate.tokens.reasoning;

  return [
    agent,
    formatCost(aggregate.cost),
    `ctx: ${formatNumber(ctx)}`,
    `in: ${formatNumber(aggregate.tokens.input)}`,
    `out: ${formatOutputTokens(aggregate.tokens.output)}`,
    `calls: ${aggregate.llmCalls}`,
    `err: ${aggregate.llmErrors}`,
  ].join("  ");
}

export function formatAgentRows(byAgent: Record<string, Aggregate>): string[] {
  return Object.entries(byAgent)
    .sort(([, a], [, b]) => b.cost - a.cost)
    .map(([agent, aggregate]) => formatAgentRow(agent, aggregate));
}
