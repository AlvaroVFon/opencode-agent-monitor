import type { Aggregate } from "../../shared/metrics.types";
import { MetricsAggregatorHelper } from "./metrics-aggregator.helper";

type TotalsWithSessions = Aggregate & {
  sessionsCreated: number;
  sessionErrors: number;
};

export class SnapshotTransformHelper {
  constructor(private readonly helper: MetricsAggregatorHelper) {}

  topNByCost(
    record: Record<string, Aggregate>,
    n: number,
  ): Record<string, Aggregate> {
    return Object.entries(record)
      .sort(([, a], [, b]) => b.cost - a.cost)
      .slice(0, n)
      .reduce<Record<string, Aggregate>>((acc, [k, v]) => {
        acc[k] = v;
        return acc;
      }, {});
  }

  zeroedTotals(): TotalsWithSessions {
    return {
      ...this.helper.emptyAggregate(),
      sessionsCreated: 0,
      sessionErrors: 0,
    };
  }
}
