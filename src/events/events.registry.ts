import { EventType } from "../enums";
import { Handler } from "../handler.interface";

export class EventsRegistry {
  private readonly handlers = new Map<string, Handler[]>();

  register(eventType: EventType, handler: Handler): this {
    const handlers = this.handlers.get(eventType) ?? [];
    handlers.push(handler);
    this.handlers.set(eventType, handlers);
    return this;
  }

  get(eventType: string): Handler[] | undefined {
    return this.handlers.get(eventType);
  }
}
