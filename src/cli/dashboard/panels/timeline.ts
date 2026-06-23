import type { DashboardPanel } from "../dashboard.types";
import type { DashboardData, TimelineRow } from "../dashboard.types";
import { escapeHtml, fmt } from "../dashboard-helpers";
import { TIMELINE_PANEL_TEMPLATE } from "../templates/panels/timeline";

type TimelinePanelData = {
  hasData: boolean;
  content: string;
  emptyMessage: string;
};

/**
 * Group timeline rows by sessionID, preserving chronological order
 * (rows are already sorted by timestamp from DashboardAggregator).
 */
function groupBySession(timeline: TimelineRow[]): Map<string, TimelineRow[]> {
  const bySession = new Map<string, TimelineRow[]>();
  for (const row of timeline) {
    const group = bySession.get(row.sessionID) ?? [];
    group.push(row);
    bySession.set(row.sessionID, group);
  }
  return bySession;
}

/**
 * Build a single session block with a heading and event entries.
 * sessionID is HTML-escaped.
 */
function buildSessionBlock(sessionID: string, rows: TimelineRow[]): string {
  const items = rows
    .map(
      (r) =>
        `<div class="flex items-center justify-between border-b border-gray-100 py-2 text-sm">
  <div class="flex items-center gap-2">
    <span class="inline-block h-2 w-2 rounded-full bg-blue-400"></span>
    <span class="text-gray-700">${escapeHtml(r.type)}</span>
  </div>
  <span class="text-gray-500">${r.durationMs > 0 ? `${fmt(r.durationMs)}ms` : "—"}</span>
</div>`,
    )
    .join("\n");

  return `<div class="mb-4">
  <h3 class="mb-2 text-sm font-semibold text-gray-600">${escapeHtml(sessionID)}</h3>
  ${items}
</div>`;
}

export const timelinePanel: DashboardPanel<TimelinePanelData> = {
  id: "timeline",
  title: "Timeline",
  gridClass: "md:col-span-2",

  dataProvider: (data: DashboardData): TimelinePanelData => {
    if (data.timeline.length === 0) {
      return {
        hasData: false,
        content: "",
        emptyMessage: "No timeline data",
      };
    }

    const bySession = groupBySession(data.timeline);
    const sessionBlocks: string[] = [];
    for (const [sessionID, rows] of bySession) {
      sessionBlocks.push(buildSessionBlock(sessionID, rows));
    }

    return {
      hasData: true,
      content: sessionBlocks.join("\n"),
      emptyMessage: "",
    };
  },

  templateSource: TIMELINE_PANEL_TEMPLATE,
};
