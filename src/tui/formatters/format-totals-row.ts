import type { MetricsSnapshot } from "../../shared/metrics.types";

function formatNumber(n: number): string {
  return n.toLocaleString("en-US");
}

export function formatTotalsRow(snapshot: MetricsSnapshot): {
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
    calls: formatNumber(snapshot.totals.llmCalls),
    errors: formatNumber(
      snapshot.totals.llmErrors +
        snapshot.totals.toolErrors +
        (snapshot.totals.sessionErrors ?? 0),
    ),
  };
}
