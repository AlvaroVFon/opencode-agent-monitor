/**
 * Keeps the agent currently associated with each session.
 *
 * V2 reveals the agent per step (`session.step.started`) and when the session
 * agent changes (`session.agent.selected`). Sessions are few compared to
 * messages, so this map does not need eviction.
 */
export class AgentTracker {
  private readonly bySession = new Map<string, string>();

  recordSessionAgent(sessionID: string, agent: string): void {
    this.bySession.set(sessionID, agent);
  }

  agentForSession(sessionID: string): string | undefined {
    return this.bySession.get(sessionID);
  }

  clear(): void {
    this.bySession.clear();
  }
}
