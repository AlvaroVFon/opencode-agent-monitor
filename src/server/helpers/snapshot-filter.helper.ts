import type { MetricsSnapshot } from "../../shared/metrics.types";
import { SnapshotTransformHelper } from "./snapshot-transform.helper";

export class SnapshotFilterHelper {
  constructor(private readonly transform: SnapshotTransformHelper) {}

  since(base: MetricsSnapshot, since: number): MetricsSnapshot | null {
    if (base.window.lastSeenAt >= since) return null;
    return {
      ...base,
      totals: this.transform.zeroedTotals(),
      bySession: {},
      byAgent: {},
      byModel: {},
      byAgentModel: {},
      byTool: {},
      errors: [],
    };
  }

  sessionID(base: MetricsSnapshot, id: string): MetricsSnapshot {
    const agg = base.bySession[id];
    return {
      ...base,
      bySession: agg ? { [id]: agg } : {},
      byAgent: {},
      byModel: {},
      byAgentModel: {},
      byTool: {},
    };
  }

  groupBy(base: MetricsSnapshot, group: string): MetricsSnapshot {
    return {
      ...base,
      bySession: group === "session" ? base.bySession : {},
      byAgent: group === "agent" ? base.byAgent : {},
      byModel: group === "model" ? base.byModel : {},
      byTool: group === "tool" ? base.byTool : {},
      byAgentModel: {},
    };
  }

  top(base: MetricsSnapshot, n: number): MetricsSnapshot {
    return {
      ...base,
      bySession: this.transform.topNByCost(base.bySession, n),
      byAgent: this.transform.topNByCost(base.byAgent, n),
      byModel: this.transform.topNByCost(base.byModel, n),
    };
  }
}
