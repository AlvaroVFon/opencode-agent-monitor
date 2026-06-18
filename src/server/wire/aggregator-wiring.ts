import { AggregateHelper } from "../../shared/aggregate.helpers";
import { SnapshotTransformHelper } from "../helpers/snapshot-transform.helper";
import { SnapshotFilterHelper } from "../helpers/snapshot-filter.helper";
import { MetricsAggregator } from "../metrics/metrics.aggregator";

export function createMetricsAggregator(
  currentAgent: Map<string, string>,
): MetricsAggregator {
  const helper = new AggregateHelper();
  const transform = new SnapshotTransformHelper(helper);
  const filter = new SnapshotFilterHelper(transform);
  return new MetricsAggregator(currentAgent, helper, filter);
}
