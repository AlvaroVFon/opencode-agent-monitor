import { EventType } from "../enums";
import { Handler } from "../handler.interface";

/**
 * Registry entry. Handlers are stored behind `Handler<never>` because the
 * dispatcher only invokes them with events matching their registration key;
 * `never` keeps the untyped slot assignable from every concrete handler.
 */
export type RegisteredHandler = Handler<never>;

export class EventsRegistry {
  private readonly handlers = new Map<string, RegisteredHandler[]>();

  register(eventType: EventType, handler: RegisteredHandler): this {
    const handlers = this.handlers.get(eventType) ?? [];
    handlers.push(handler);
    this.handlers.set(eventType, handlers);
    return this;
  }

  get(eventType: string): RegisteredHandler[] | undefined {
    return this.handlers.get(eventType);
  }
}
