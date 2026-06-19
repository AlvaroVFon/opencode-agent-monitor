import type { GetAgent } from "../handler.interface";
import { TraceEventType } from "../enums";
import { EventsRegistry } from "./events.registry";
import { TraceHelper } from "../helpers/trace.helpers";

export class EventHandler {
  constructor(
    private readonly traceHelper: TraceHelper,
    private readonly eventsRegistry: EventsRegistry,
  ) {}

  handle(
    event: { type: string; properties: unknown },
    getAgent?: GetAgent,
  ): void {
    const handlers = this.eventsRegistry.get(event.type);

    if (!handlers || handlers.length === 0) {
      return;
    }

    for (const handler of handlers) {
      handler.handle(event.properties, getAgent);
    }
  }
}
