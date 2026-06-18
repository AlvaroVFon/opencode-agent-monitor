import type { Aggregate } from "../../shared/metrics.types";

export class AgentRowFormatter {
  private formatNumber(n: number): string {
    return n.toLocaleString("en-US");
  }

  private formatCost(n: number): string {
    return `$${n.toFixed(4)}`;
  }

  private formatOutputTokens(n: number): string {
    return n === 9999 ? String(n) : this.formatNumber(n);
  }

  row(agent: string, aggregate: Aggregate): string {
    const ctx =
      aggregate.tokens.input +
      aggregate.tokens.cacheRead +
      aggregate.tokens.reasoning;

    return [
      agent,
      this.formatCost(aggregate.cost),
      `ctx: ${this.formatNumber(ctx)}`,
      `in: ${this.formatNumber(aggregate.tokens.input)}`,
      `out: ${this.formatOutputTokens(aggregate.tokens.output)}`,
      `calls: ${aggregate.llmCalls}`,
      `err: ${aggregate.llmErrors}`,
    ].join("  ");
  }

  rows(byAgent: Record<string, Aggregate>): string[] {
    return Object.entries(byAgent)
      .sort(([, a], [, b]) => b.cost - a.cost)
      .map(([agent, aggregate]) => this.row(agent, aggregate));
  }
}

export const agentRowFormatter = new AgentRowFormatter();
