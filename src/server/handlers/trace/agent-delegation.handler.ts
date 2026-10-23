import { TraceHelper } from "../../helpers/trace.helpers";
import { TraceEventType } from "../../enums";
import { Handler } from "../../handler.interface";
import type { SessionCreatedEvent } from "../../types";

/**
 * V2 models delegation as a child session. `session.created` with a parent is
 * the authoritative delegation signal and replaces the V1 `agent`/`subtask`
 * message-part handlers.
 */
export class AgentDelegationHandler implements Handler<SessionCreatedEvent> {
  constructor(private readonly traceHelper: TraceHelper) {}

  handle(event: SessionCreatedEvent): void {
    const { sessionID, parentID, agent, title } = event.data;
    if (!parentID) return;

    this.traceHelper.writeTrace({
      type: TraceEventType.AGENT_DELEGATION,
      sessionID,
      parentID,
      childSessionID: sessionID,
      ...(agent ? { childAgent: agent } : {}),
      ...(title ? { description: title } : {}),
      timestamp: event.created,
    });
  }
}
