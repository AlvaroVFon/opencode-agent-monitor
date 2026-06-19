import { AggregateHelper } from "../../shared/aggregate.helpers";
import { SnapshotTransformHelper } from "../helpers/snapshot-transform.helper";
import { SnapshotFilterHelper } from "../helpers/snapshot-filter.helper";
import { EventType } from "../enums";
import { MetricsAggregator } from "../metrics/metrics.aggregator";
import { MetricsHandlersRegistry } from "../metrics/metrics.handler-map";
import { MessageUpdatedMetricsHandler } from "../handlers/metrics/message-updated.metrics-handler";
import { MessagePartUpdatedMetricsHandler } from "../handlers/metrics/message-part-updated.metrics-handler";
import { SessionCreatedMetricsHandler } from "../handlers/metrics/session-created.metrics-handler";
import { SessionErrorMetricsHandler } from "../handlers/metrics/session-error.metrics-handler";

export function buildDefaultRegistry(): MetricsHandlersRegistry {
  return new MetricsHandlersRegistry()
    .register(EventType.MESSAGE_UPDATED, new MessageUpdatedMetricsHandler())
    .register(
      EventType.MESSAGE_PART_UPDATED,
      new MessagePartUpdatedMetricsHandler(),
    )
    .register(EventType.SESSION_CREATED, new SessionCreatedMetricsHandler())
    .register(EventType.SESSION_ERROR, new SessionErrorMetricsHandler());
}

export function createMetricsAggregator(): MetricsAggregator {
  const helper = new AggregateHelper();
  const transform = new SnapshotTransformHelper(helper);
  const filter = new SnapshotFilterHelper(transform);
  return new MetricsAggregator(helper, filter, buildDefaultRegistry());
}
