import { TraceHelper } from "../../helpers/trace.helpers";
import { UNKNOWN, TraceEventType } from "../../enums";
import { Handler } from "../../handler.interface";
import { AgentTracker } from "../../state/agent-tracker";
import type { SessionCompactionEndedEvent } from "../../types";

/**
 * Compaction runs its own model request. V2 reports its usage on
 * `session.compaction.ended`, so the trace counts it as an auxiliary LLM call
 * instead of losing the spend.
 */
export class CompactionEndedHandler implements Handler<SessionCompactionEndedEvent> {
  constructor(
    private readonly traceHelper: TraceHelper,
    private readonly agentTracker: AgentTracker,
  ) {}

  handle(event: SessionCompactionEndedEvent): void {
    const { sessionID, model, cost, tokens } = event.data;
    const agent = this.agentTracker.agentForSession(sessionID) ?? UNKNOWN;

    this.traceHelper.writeTrace({
      type: TraceEventType.LLM_CALL,
      sessionID,
      agent,
      model: this.formatModel(model),
      finish: "auxiliary",
      inputTokens: tokens?.input ?? 0,
      outputTokens: tokens?.output ?? 0,
      reasoningTokens: tokens?.reasoning ?? 0,
      cacheRead: tokens?.cache?.read ?? 0,
      cacheWrite: tokens?.cache?.write ?? 0,
      cost: cost ?? 0,
      durationMs: 0,
      kind: "compaction",
      timestamp: event.created,
    });
  }

  private formatModel(model?: { providerID?: string; id?: string }): string {
    if (!model?.providerID || !model?.id) return UNKNOWN;
    return `${model.providerID}/${model.id}`;
  }
}
