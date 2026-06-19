import { EventType } from "../enums";
import { Handler } from "../handler.interface";
import type {
  MessagePartUpdatedProps,
  MessageUpdatedProps,
  SessionCreatedProps,
  SessionErrorProps,
} from "../types";

export type HandlerMap = {
  [EventType.SESSION_CREATED]: Handler<SessionCreatedProps>;
  [EventType.SESSION_ERROR]: Handler<SessionErrorProps>;
  [EventType.MESSAGE_UPDATED]: Handler<MessageUpdatedProps>;
  [EventType.MESSAGE_PART_UPDATED]: Handler<MessagePartUpdatedProps>;
};

export class EventsRegistry {
  private readonly handlers = new Map<string, Handler[]>();

  register<E extends EventType>(eventType: E, handler: HandlerMap[E]): this {
    const handlers = this.handlers.get(eventType) ?? [];
    handlers.push(handler as Handler);
    this.handlers.set(eventType, handlers);
    return this;
  }

  get(eventType: string): Handler[] | undefined {
    return this.handlers.get(eventType);
  }
}
