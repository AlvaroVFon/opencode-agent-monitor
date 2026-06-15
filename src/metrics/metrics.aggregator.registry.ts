import { EventType } from "../enums";

export type MetricsHandler = (properties: unknown) => void;

export class MetricsHandlersRegistry {
  private readonly handlers = new Map<EventType, MetricsHandler>();

  register(eventType: EventType, handler: MetricsHandler): this {
    this.handlers.set(eventType, handler);
    return this;
  }

  dispatch(event: { type: string; properties: unknown }): void {
    const handler = this.handlers.get(event.type as EventType);
    if (!handler) return;
    handler(event.properties);
  }
}
