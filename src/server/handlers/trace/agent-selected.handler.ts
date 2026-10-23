import { Handler } from "../../handler.interface";
import { AgentTracker } from "../../state/agent-tracker";
import type { SessionAgentSelectedEvent } from "../../types";

/**
 * Keeps a per-session fallback agent for messages whose step metadata arrived
 * before this plugin subscribed, and for auxiliary usage events.
 */
export class AgentSelectedHandler implements Handler<SessionAgentSelectedEvent> {
  constructor(private readonly agentTracker: AgentTracker) {}

  handle(event: SessionAgentSelectedEvent): void {
    const { sessionID, agent } = event.data;
    if (!agent) return;
    this.agentTracker.recordSessionAgent(sessionID, agent);
  }
}
