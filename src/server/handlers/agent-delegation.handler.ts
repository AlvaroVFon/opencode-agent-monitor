import { TraceHelper } from "../helpers/trace.helpers";
import { TraceEventType, PartType } from "../enums";
import { Handler } from "../handler.interface";
import type { MessagePartUpdatedProps } from "../types";

export class AgentDelegationHandler implements Handler<MessagePartUpdatedProps> {
  constructor(private readonly traceHelper: TraceHelper) {}

  handle(properties: MessagePartUpdatedProps): void {
    const part = properties.part;

    if (part.type !== PartType.AGENT) return;

    this.traceHelper.writeTrace({
      type: TraceEventType.AGENT_DELEGATION,
      sessionID: part.sessionID,
      childAgent: part.name,
      timestamp: Date.now(),
    });
  }
}
