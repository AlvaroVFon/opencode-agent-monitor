import { EventType } from "../enums";
import type { MetricsHandler } from "./metrics-handler.interface";
import type {
  MessagePartUpdatedProps,
  MessageUpdatedProps,
  SessionCreatedProps,
  SessionErrorProps,
} from "../types";

export type MetricsHandlerMap = {
  [EventType.MESSAGE_UPDATED]: MetricsHandler<MessageUpdatedProps>;
  [EventType.MESSAGE_PART_UPDATED]: MetricsHandler<MessagePartUpdatedProps>;
  [EventType.SESSION_CREATED]: MetricsHandler<SessionCreatedProps>;
  [EventType.SESSION_ERROR]: MetricsHandler<SessionErrorProps>;
};

export class MetricsHandlersRegistry {
  private readonly handlers = new Map<string, MetricsHandler[]>();

  register<E extends EventType>(
    eventType: E,
    handler: MetricsHandlerMap[E],
  ): this {
    const list = this.handlers.get(eventType) ?? [];
    list.push(handler as MetricsHandler);
    this.handlers.set(eventType, list);
    return this;
  }

  get(eventType: string): MetricsHandler[] {
    return this.handlers.get(eventType) ?? [];
  }
}
