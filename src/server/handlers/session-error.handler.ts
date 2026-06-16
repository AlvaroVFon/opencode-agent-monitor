import { TraceHelper } from "../helpers/trace.helpers";
import { extractErrorMessage } from "../helpers/error.helpers";
import { TraceEventType, UNKNOWN } from "../enums";
import { Handler } from "../handler.interface";
import type { SessionErrorProps } from "../types";

export class SessionErrorHandler implements Handler {
  constructor(private readonly traceHelper: TraceHelper) {}

  handle(properties: unknown): void {
    const { sessionID, error } = properties as SessionErrorProps;

    const errorName = error?.name ?? UNKNOWN;
    const errorMessage = extractErrorMessage(error?.data);

    this.traceHelper.writeTrace({
      type: TraceEventType.SESSION_ERROR,
      sessionID: sessionID ?? null,
      errorType: errorName,
      errorMessage,
      timestamp: Date.now(),
    });

    this.traceHelper.writeTraceError({
      type: TraceEventType.SESSION_ERROR,
      sessionID: sessionID ?? null,
      error: `${errorName}: ${errorMessage}`,
      timestamp: Date.now(),
    });
  }
}
