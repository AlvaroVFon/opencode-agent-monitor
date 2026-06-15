import { TraceHelper } from "../helpers/trace.helpers";
import { TraceEventType } from "../enums";
import { Handler } from "../handler.interface";
import type { MessagePartUpdatedProps } from "../types";

export class ToolCallHandler implements Handler {
  constructor(private readonly traceHelper: TraceHelper) {}

  handle(properties: unknown): void {
    const part = (properties as MessagePartUpdatedProps).part;

    if (part.type !== "tool") return;
    if (part.state.status !== "completed" && part.state.status !== "error") return;

    const durationMs =
      part.state.time?.end && part.state.time?.start
        ? part.state.time.end - part.state.time.start
        : null;

    this.traceHelper.writeTrace({
      type: TraceEventType.TOOL_CALL,
      sessionID: part.sessionID,
      tool: part.tool,
      callID: part.callID,
      status: part.state.status,
      durationMs,
      ...(part.state.status === "error" ? { error: part.state.error } : {}),
      timestamp: Date.now(),
    });
  }
}
