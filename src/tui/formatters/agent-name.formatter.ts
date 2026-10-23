/** Number of categorical colors used to distinguish agents. */
export const AGENT_PALETTE_SIZE = 5;

export class AgentNameFormatter {
  capitalize(name: string): string {
    if (name.length === 0) return "";
    const first = name.charAt(0);
    const upper = first.toUpperCase();
    return upper + name.slice(1);
  }

  /**
   * Deterministic palette index (DJB2 hash) for an agent name. The host theme
   * maps the index to a categorical color.
   */
  colorIndex(name: string): number {
    let hash = 5381;
    for (let i = 0; i < name.length; i++) {
      hash = ((hash << 5) + hash + name.charCodeAt(i)) | 0;
    }
    return Math.abs(hash) % AGENT_PALETTE_SIZE;
  }
}

export const agentNameFormatter = new AgentNameFormatter();
