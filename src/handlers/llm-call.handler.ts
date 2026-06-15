import { TraceHelper } from "../helpers/trace.helpers";
import { TraceEventType, UNKNOWN, Role } from "../enums";
import { Handler } from "../handler.interface";
import type { MessageUpdatedProps } from "../types";

export class LlmCallHandler implements Handler {
  constructor(
    private readonly traceHelper: TraceHelper,
    private readonly currentAgent: Map<string, string>,
  ) {}

  handle(properties: unknown): void {
    const msg = (properties as MessageUpdatedProps).info;

    if (msg.role !== Role.ASSISTANT || !msg.finish || !msg.tokens) return;

    const agent = this.currentAgent.get(msg.sessionID) ?? UNKNOWN;
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
