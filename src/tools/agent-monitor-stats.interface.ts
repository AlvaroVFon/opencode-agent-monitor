import type { MetricsSnapshot } from "../metrics/metrics.aggregator.interface";

export type StatsFormat = "markdown" | "json";

export type StatsGroupBy = "agent" | "model" | "tool";

export type StatsTimeRange = "1h" | "24h" | "7d" | "all";

export type StatsToolArgs = {
  since: StatsTimeRange;
  groupBy?: StatsGroupBy;
  sessionID?: string;
  format: StatsFormat;
};

export type FilteredSnapshot = {
  totals: MetricsSnapshot["totals"];
  bySession: Record<string, MetricsSnapshot["bySession"][string]>;
  byAgent: Record<string, MetricsSnapshot["byAgent"][string]>;
  byModel: Record<string, MetricsSnapshot["byModel"][string]>;
  window: MetricsSnapshot["window"];
};
