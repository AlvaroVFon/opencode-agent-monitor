import { TraceHelper } from "../helpers/trace.helpers";
import { TraceEventType, UNKNOWN, Role } from "../enums";
import { Handler, type GetAgent } from "../handler.interface";
import type { MessageUpdatedProps } from "../types";

export class LlmCallHandler implements Handler<MessageUpdatedProps> {
  constructor(private readonly traceHelper: TraceHelper) {}

  handle(properties: MessageUpdatedProps, getAgent?: GetAgent): void {
    const msg = properties.info;

    if (msg.role !== Role.ASSISTANT || !msg.finish || !msg.tokens) return;
    if (!msg.time?.completed) return;

    const agent = getAgent?.(msg.sessionID) ?? UNKNOWN;
    const model = `${msg.providerID}/${msg.modelID}`;
    const durationMs =
      msg.time?.completed && msg.time?.created
        ? msg.time.completed - msg.time.created
        : null;

    this.traceHelper.writeTrace({
      type: TraceEventType.LLM_CALL,
      sessionID: msg.sessionID,
      agent,
      model,
      finish: msg.finish,
      inputTokens: msg.tokens.input,
      outputTokens: msg.tokens.output,
      reasoningTokens: msg.tokens.reasoning,
      cacheRead: msg.tokens.cache.read,
      cost: msg.cost,
      durationMs,
      timestamp: Date.now(),
    });
  }
}
