import { TraceHelper } from "../../helpers/trace.helpers";
import { PartStatus, PartType, TraceEventType } from "../../../shared/enums";
import { Handler } from "../../handler.interface";
import type { MessagePartUpdatedProps } from "../../types";

export class SkillCallHandler implements Handler<MessagePartUpdatedProps> {
  constructor(private readonly traceHelper: TraceHelper) {}

  handle(properties: MessagePartUpdatedProps): void {
    const part = properties.part as {
      type?: string;
      sessionID?: string;
      tool?: string;
      state?: {
        status?: string;
        time?: { start?: number; end?: number };
        error?: unknown;
        input?: Record<string, unknown>;
      };
    };

    if (part.type !== PartType.TOOL || part.tool !== "skill") return;
    if (
      part.state?.status !== PartStatus.COMPLETED &&
      part.state?.status !== PartStatus.ERROR
    )
      return;

    const durationMs =
      part.state?.time?.end && part.state?.time?.start
        ? part.state.time.end - part.state.time.start
        : 0;
    const skillName =
      (part.state?.input?.name as string | undefined) ?? "unknown";

    this.traceHelper.writeTrace({
      type: TraceEventType.SKILL_CALL,
      sessionID: part.sessionID ?? "unknown",
      skill: skillName,
      status: part.state.status,
      durationMs,
      ...(part.state.status === PartStatus.ERROR
        ? { error: part.state.error }
        : {}),
      timestamp: Date.now(),
    });
  }
}
