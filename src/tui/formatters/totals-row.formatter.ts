import type { MetricsSnapshot } from "../../shared/metrics.types";

export class TotalsRowFormatter {
  private formatNumber(n: number): string {
    return n.toLocaleString("en-US");
  }

  format(snapshot: MetricsSnapshot): {
    avgCostPerCall: string;
    calls: string;
    errors: string;
  } {
    const avgCostPerCall =
      snapshot.totals.llmCalls > 0
        ? `$${(snapshot.totals.cost / snapshot.totals.llmCalls).toFixed(4)}`
        : "$0.0000";
    return {
      avgCostPerCall,
      calls: this.formatNumber(snapshot.totals.llmCalls),
      errors: this.formatNumber(
        snapshot.totals.llmErrors +
          snapshot.totals.toolErrors +
          (snapshot.totals.sessionErrors ?? 0),
      ),
    };
  }
}

export const totalsRowFormatter = new TotalsRowFormatter();
