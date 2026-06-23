import type {
  DashboardPanel,
  DashboardData,
  TimelineRow,
} from "../dashboard.types";
import { EVENT_METRICS_PANEL_TEMPLATE } from "../templates/panels/event-metrics";

export type EventMetricsData = {
  hasData: boolean;
  typeCounts: Array<{
    type: string;
    count: number;
    avgDurationMs: number;
  }>;
  top5Slowest: Array<{
    type: string;
    durationMs: number;
  }>;
  emptyMessage: string;
};

/**
 * Aggregate timeline events into per-type metrics.
 *
 * Derived data provider — reads existing TimelineRow[] and produces
 * aggregated summaries (counts, average duration, top-5 slowest)
 * without adding new metrics to DashboardAggregator.
 *
 * @param timeline - Raw timeline rows from DashboardData
 * @returns Aggregated event metrics (no raw rows)
 */
export function aggregateEventMetrics(
  timeline: TimelineRow[],
): EventMetricsData {
  if (timeline.length === 0) {
    return {
      hasData: false,
      typeCounts: [],
      top5Slowest: [],
      emptyMessage: "No events recorded",
    };
  }

  // ── Group by type ─────────────────────────────────────────────────────
  const byType = new Map<string, { count: number; totalDuration: number }>();

  for (const row of timeline) {
    const entry = byType.get(row.type) ?? { count: 0, totalDuration: 0 };
    entry.count += 1;
    entry.totalDuration += row.durationMs;
    byType.set(row.type, entry);
  }

  // ── Build type counts with averages ──────────────────────────────────
  const typeCounts: EventMetricsData["typeCounts"] = [];
  for (const [type, { count, totalDuration }] of byType) {
    typeCounts.push({
      type,
      count,
      avgDurationMs: count > 0 ? Math.round(totalDuration / count) : 0,
    });
  }

  // ── Top 5 slowest events ─────────────────────────────────────────────
  const sorted = [...timeline].sort((a, b) => b.durationMs - a.durationMs);
  const top5Slowest: EventMetricsData["top5Slowest"] = sorted
    .slice(0, 5)
    .map((row) => ({
      type: row.type,
      durationMs: row.durationMs,
    }));

  return {
    hasData: true,
    typeCounts,
    top5Slowest,
    emptyMessage: "",
  };
}

export const eventMetricsPanel: DashboardPanel<EventMetricsData> = {
  id: "event-metrics",
  title: "Event Metrics",
  gridClass: "md:col-span-2",

  dataProvider: (data: DashboardData): EventMetricsData => {
    return aggregateEventMetrics(data.timeline);
  },

  templateSource: EVENT_METRICS_PANEL_TEMPLATE,
};
