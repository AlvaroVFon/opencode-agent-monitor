import { TraceHelper } from "../helpers/trace.helpers";
import { extractErrorMessage } from "../helpers/error.helpers";
import { TraceEventType, UNKNOWN, Role } from "../enums";
import { Handler } from "../handler.interface";
import type { MessageUpdatedProps } from "../types";

export class LlmErrorHandler implements Handler<MessageUpdatedProps> {
  constructor(
    private readonly traceHelper: TraceHelper,
    private readonly currentAgent: Map<string, string>,
  ) {}

  handle(properties: MessageUpdatedProps): void {
    const msg = properties.info;

    if (msg.role !== Role.ASSISTANT || !msg.error || msg.tokens) return;

    const agent = this.currentAgent.get(msg.sessionID) ?? UNKNOWN;
    const model = `${msg.providerID}/${msg.modelID}`;
    const { name: errorName, data } = msg.error;

    this.traceHelper.writeTrace({
      type: TraceEventType.LLM_ERROR,
      sessionID: msg.sessionID,
      agent,
      model,
      errorType: errorName,
      errorMessage: extractErrorMessage(data),
      timestamp: Date.now(),
    });

    this.traceHelper.writeTraceError({
      type: TraceEventType.LLM_ERROR,
      sessionID: msg.sessionID,
      agent,
      model,
      errorType: errorName,
      errorMessage: extractErrorMessage(data),
      timestamp: Date.now(),
    });
  }
}
