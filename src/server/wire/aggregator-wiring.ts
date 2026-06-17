import { EventType } from "../enums";
import type {
  MessagePartUpdatedProps,
  MessageUpdatedProps,
  SessionCreatedProps,
  SessionErrorProps,
} from "../types";
import { MetricsAggregatorHelper } from "../helpers/metrics-aggregator.helper";
import { SnapshotTransformHelper } from "../helpers/snapshot-transform.helper";
import { SnapshotFilterHelper } from "../helpers/snapshot-filter.helper";
import { MetricsHandlersRegistry } from "../metrics/metrics.aggregator.registry";
import { MetricsAggregator } from "../metrics/metrics.aggregator";

export function buildMetricsHandlersRegistry(
  aggregator: MetricsAggregator,
): MetricsHandlersRegistry {
  return new MetricsHandlersRegistry()
    .register(EventType.MESSAGE_UPDATED, (properties) =>
      aggregator.ingestMessage(properties as MessageUpdatedProps),
    )
    .register(EventType.MESSAGE_PART_UPDATED, (properties) =>
      aggregator.ingestPart(properties as MessagePartUpdatedProps),
    )
    .register(EventType.SESSION_CREATED, (properties) =>
      aggregator.ingestSessionCreated(properties as SessionCreatedProps),
    )
    .register(EventType.SESSION_ERROR, (properties) =>
      aggregator.ingestSessionError(properties as SessionErrorProps),
    );
}

export function createMetricsAggregator(
  currentAgent: Map<string, string>,
): MetricsAggregator {
  const helper = new MetricsAggregatorHelper();
  const transform = new SnapshotTransformHelper(helper);
  const filter = new SnapshotFilterHelper(transform);
  const aggregator = new MetricsAggregator(currentAgent, helper, filter);
  aggregator.init(buildMetricsHandlersRegistry(aggregator));
  return aggregator;
}
