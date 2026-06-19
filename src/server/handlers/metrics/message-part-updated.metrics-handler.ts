import { PartStatus, PartType, UNKNOWN } from "../../enums";
import type { GetAgent } from "../../handler.interface";
import type {
  MetricsHandler,
  MetricsRecorder,
} from "../../metrics/metrics-handler.interface";
import type { MessagePartUpdatedProps } from "../../types";

export class MessagePartUpdatedMetricsHandler implements MetricsHandler<MessagePartUpdatedProps> {
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
      };
    };

    if (part.type !== PartType.TOOL) return;
    if (!part.sessionID) return;

    const status = part.state?.status;
    if (status !== PartStatus.COMPLETED && status !== PartStatus.ERROR) return;

    const sessionID = part.sessionID;
    const agent = getAgent?.(sessionID) ?? UNKNOWN;
    const toolName = part.tool ?? UNKNOWN;
    const durationMs =
      part.state?.time?.start && part.state?.time?.end
        ? part.state.time.end - part.state.time.start
        : 0;

    recorder.recordToolCall(
      sessionID,
      agent,
      toolName,
      status === PartStatus.ERROR,
      durationMs,
    );

    if (status === PartStatus.ERROR) {
      recorder.pushError({
        sessionID,
        type: "tool_error",
        message: String(part.state?.error ?? ""),
        timestamp: Date.now(),
      });
    }
  }
}
