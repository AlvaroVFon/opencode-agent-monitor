import { TraceHelper } from "../../helpers/trace.helpers";
import { TraceEventType } from "../../enums";
import { Handler } from "../../handler.interface";
import type { SessionSkillActivatedEvent } from "../../types";

export class SkillCallHandler implements Handler<SessionSkillActivatedEvent> {
  constructor(private readonly traceHelper: TraceHelper) {}

  handle(event: SessionSkillActivatedEvent): void {
    const { sessionID, id, name } = event.data;

    this.traceHelper.writeTrace({
      type: TraceEventType.SKILL_CALL,
      sessionID,
      skill: name || id,
      skillID: id,
      status: "completed",
      // V2 activation has no duration; keep the field for schema stability.
      durationMs: 0,
      timestamp: event.created,
    });
  }
}
