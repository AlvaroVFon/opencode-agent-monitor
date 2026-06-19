import { TraceHelper } from "../../helpers/trace.helpers";
import { TraceEventType, PartType } from "../../../shared/enums";
import { Handler } from "../../handler.interface";
import type { MessagePartUpdatedProps } from "../../types";

export class SubtaskDelegationHandler implements Handler<MessagePartUpdatedProps> {
  constructor(private readonly traceHelper: TraceHelper) {}

  handle(properties: MessagePartUpdatedProps): void {
    const part = properties.part;

    if (part.type !== PartType.SUBTASK) return;

    this.traceHelper.writeTrace({
      type: TraceEventType.AGENT_DELEGATION,
      sessionID: part.sessionID,
      childAgent: part.agent,
      description: part.description,
      timestamp: Date.now(),
    });
  }
}
