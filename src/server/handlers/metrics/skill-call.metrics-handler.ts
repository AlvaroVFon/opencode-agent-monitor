import { PartStatus, PartType } from "../../../shared/enums";
import { UNKNOWN } from "../../enums";
import type { GetAgent } from "../../handler.interface";
import type {
  MetricsHandler,
  MetricsRecorder,
} from "../../metrics/metrics-handler.interface";
import type { MessagePartUpdatedProps } from "../../types";

export class SkillCallMetricsHandler implements MetricsHandler<MessagePartUpdatedProps> {
  handle(
    props: MessagePartUpdatedProps,
    recorder: MetricsRecorder,
    getAgent?: GetAgent,
  ): void {
    const part = props.part as {
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
    if (!part.sessionID) return;

    const status = part.state?.status;
    if (status !== PartStatus.COMPLETED && status !== PartStatus.ERROR) return;

    const skill = (part.state?.input?.name as string | undefined) ?? UNKNOWN;
    const durationMs =
      part.state?.time?.start && part.state?.time?.end
        ? part.state.time.end - part.state.time.start
        : 0;

    recorder.recordSkillCall(
      part.sessionID,
      skill,
      status === PartStatus.ERROR,
      durationMs,
    );

    if (status === PartStatus.ERROR) {
      recorder.pushError({
        sessionID: part.sessionID,
        type: "skill_error",
        message: String(part.state?.error ?? ""),
        timestamp: Date.now(),
      });
    }
  }
}
