import { TraceHelper } from "../../helpers/trace.helpers";
import { UNKNOWN, TraceEventType } from "../../enums";
import { Handler } from "../../handler.interface";
import type { SessionExecutionFailedEvent } from "../../types";

export class SessionErrorHandler implements Handler<SessionExecutionFailedEvent> {
  constructor(private readonly traceHelper: TraceHelper) {}

  handle(event: SessionExecutionFailedEvent): void {
    const { sessionID, error } = event.data;

    this.traceHelper.writeTrace({
      type: TraceEventType.SESSION_ERROR,
      sessionID,
      errorType: error?.type ?? UNKNOWN,
      errorMessage: error?.message ?? UNKNOWN,
      timestamp: event.created,
    });
  }
}
