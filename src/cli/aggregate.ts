import type { MetricsSnapshot } from "../shared/metrics.types";
import type { TraceEvent } from "../shared/trace-events.types";
import { windowHelper } from "./helpers/window.helper";
import { eventAggregatorHelper } from "./helpers/event-aggregator.helper";

export class CliAggregator {
  aggregate(events: TraceEvent[]): MetricsSnapshot {
    const state = eventAggregatorHelper.emptyState();
    let { firstSeenAt, lastSeenAt } = windowHelper.empty();

    for (const ev of events) {
      const updated = windowHelper.update(
        ev.timestamp,
        firstSeenAt,
        lastSeenAt,
      );
      firstSeenAt = updated.firstSeenAt;
      lastSeenAt = updated.lastSeenAt;
      eventAggregatorHelper.apply(state, ev);
    }

    return eventAggregatorHelper.toSnapshot(state, firstSeenAt, lastSeenAt);
  }

  parseDuration(duration: string): number | null {
    if (duration === "all") return null;
    const match = duration.match(/^(\d+)([dh])$/);
    if (!match) return null;
    const value = parseInt(match[1], 10);
    const unit = match[2];
    const ms = unit === "d" ? value * 86_400_000 : value * 3_600_000;
    return Date.now() - ms;
  }

  filterEvents(
    events: TraceEvent[],
    since: number | null,
    sessionID?: string,
  ): TraceEvent[] {
    let filtered = events;
    if (since !== null) {
      filtered = filtered.filter((ev) => ev.timestamp >= since);
    }
    if (sessionID) {
      filtered = filtered.filter((ev) => {
        if ("sessionID" in ev)
          return (ev as { sessionID: string }).sessionID === sessionID;
        return true;
      });
    }
    return filtered;
  }
}

export const cliAggregator = new CliAggregator();
