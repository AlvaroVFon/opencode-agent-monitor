import { TraceHelper } from "../helpers/trace.helpers";
import { PartStatus, PartType, TraceEventType } from "../enums";
import { Handler } from "../handler.interface";
import type { MessagePartUpdatedProps } from "../types";

export class ToolCallHandler implements Handler<MessagePartUpdatedProps> {
  constructor(private readonly traceHelper: TraceHelper) {}

  handle(properties: MessagePartUpdatedProps): void {
    const part = properties.part;

    if (part.type !== PartType.TOOL) return;
    if (
      part.state.status !== PartStatus.COMPLETED &&
      part.state.status !== PartStatus.ERROR
    )
      return;

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
      ...(part.state.status === PartStatus.ERROR
        ? { error: part.state.error }
        : {}),
      timestamp: Date.now(),
    });
  }
}
