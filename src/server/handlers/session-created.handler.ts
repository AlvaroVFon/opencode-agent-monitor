import { TraceHelper } from "../helpers/trace.helpers";
import { TraceEventType } from "../enums";
import { Handler } from "../handler.interface";
import type { SessionCreatedProps } from "../types";

export class SessionCreatedHandler implements Handler {
  constructor(private readonly traceHelper: TraceHelper) {}

  handle(properties: unknown): void {
    const { info } = properties as SessionCreatedProps;

    this.traceHelper.writeTrace({
      type: TraceEventType.SESSION_CREATED,
      sessionID: info.id,
      parentID: info.parentID ?? null,
      timestamp: Date.now(),
    });
  }
}
