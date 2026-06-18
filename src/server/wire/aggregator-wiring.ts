import { MetricsAggregatorHelper } from "../helpers/metrics-aggregator.helper";
import { SnapshotTransformHelper } from "../helpers/snapshot-transform.helper";
import { SnapshotFilterHelper } from "../helpers/snapshot-filter.helper";
import { MetricsAggregator } from "../metrics/metrics.aggregator";

export function createMetricsAggregator(
  currentAgent: Map<string, string>,
): MetricsAggregator {
  const helper = new MetricsAggregatorHelper();
  const transform = new SnapshotTransformHelper(helper);
  const filter = new SnapshotFilterHelper(transform);
  return new MetricsAggregator(currentAgent, helper, filter);
}
