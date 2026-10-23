import { Handler } from "../handler.interface";
import { EventsRegistry } from "./events.registry";
import type { OpenCodeEvent } from "../types";

export class EventHandler {
  constructor(private readonly eventsRegistry: EventsRegistry) {}

  handle(event: OpenCodeEvent): void {
    const handlers = this.eventsRegistry.get(event.type);
    if (!handlers || handlers.length === 0) return;

    for (const handler of handlers) {
      (handler as Handler<OpenCodeEvent>).handle(event);
    }
  }
}
