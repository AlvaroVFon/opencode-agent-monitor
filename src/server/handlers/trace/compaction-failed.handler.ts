import { TraceHelper } from "../../helpers/trace.helpers";
import { UNKNOWN, TraceEventType } from "../../enums";
import { Handler } from "../../handler.interface";
import { AgentTracker } from "../../state/agent-tracker";
import type { SessionCompactionFailedEvent } from "../../types";

export class CompactionFailedHandler implements Handler<SessionCompactionFailedEvent> {
  constructor(
    private readonly traceHelper: TraceHelper,
    private readonly agentTracker: AgentTracker,
  ) {}

  handle(event: SessionCompactionFailedEvent): void {
    const { sessionID, error, cost, tokens } = event.data;
    const agent = this.agentTracker.agentForSession(sessionID) ?? UNKNOWN;

    this.traceHelper.writeTrace({
      type: TraceEventType.LLM_ERROR,
      sessionID,
      agent,
      model: UNKNOWN,
      errorType: error?.type ?? UNKNOWN,
      errorMessage: error?.message ?? UNKNOWN,
      ...(cost !== undefined ? { cost } : {}),
      ...(tokens
        ? {
            inputTokens: tokens.input ?? 0,
            outputTokens: tokens.output ?? 0,
            reasoningTokens: tokens.reasoning ?? 0,
            cacheRead: tokens.cache?.read ?? 0,
            cacheWrite: tokens.cache?.write ?? 0,
          }
        : {}),
      kind: "compaction",
      timestamp: event.created,
    });
  }
}
