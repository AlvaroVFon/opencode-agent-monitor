import { Role, UNKNOWN } from "../../enums";
import type { GetAgent } from "../../handler.interface";
import type {
  MetricsHandler,
  MetricsRecorder,
} from "../../metrics/metrics-handler.interface";
import type { MessageUpdatedProps } from "../../types";
import type { LlmAssistantMessage } from "../../metrics/messages.types";

export class MessageUpdatedMetricsHandler implements MetricsHandler<MessageUpdatedProps> {
  handle(
    props: MessageUpdatedProps,
    recorder: MetricsRecorder,
    getAgent?: GetAgent,
  ): void {
    const msg = props.info as LlmAssistantMessage;

    if (msg.role !== Role.ASSISTANT) return;

    const sessionID = msg.sessionID;
    if (!sessionID) return;

    const agent = getAgent?.(sessionID) ?? UNKNOWN;
    const model =
      msg.providerID && msg.modelID
        ? `${msg.providerID}/${msg.modelID}`
        : UNKNOWN;

    if (msg.error && !msg.tokens) {
      recorder.recordLlmError(sessionID, agent, model);
      return;
    }

    if (msg.finish && msg.tokens && msg.time?.completed) {
      recorder.recordLlmCall(sessionID, agent, model, {
        tokens: {
          input: msg.tokens.input,
          output: msg.tokens.output,
          reasoning: msg.tokens.reasoning,
          cacheRead: msg.tokens.cache.read,
        },
        cost: msg.cost ?? 0,
      });
    }
  }
}
