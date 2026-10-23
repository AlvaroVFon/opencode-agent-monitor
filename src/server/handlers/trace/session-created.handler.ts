import { TraceHelper } from "../../helpers/trace.helpers";
import { TraceEventType } from "../../enums";
import { Handler } from "../../handler.interface";
import type { SessionCreatedEvent } from "../../types";

export class SessionCreatedHandler implements Handler<SessionCreatedEvent> {
  constructor(private readonly traceHelper: TraceHelper) {}

  handle(event: SessionCreatedEvent): void {
    const { sessionID, parentID, agent, title } = event.data;

    this.traceHelper.writeTrace({
      type: TraceEventType.SESSION_CREATED,
      sessionID,
      parentID: parentID ?? null,
      ...(agent ? { agent } : {}),
      ...(title ? { title } : {}),
      timestamp: event.created,
    });
  }
}
