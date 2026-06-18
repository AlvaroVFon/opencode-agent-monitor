export type AgentColor =
  | "accent"
  | "secondary"
  | "info"
  | "success"
  | "warning";

const PALETTE: AgentColor[] = [
  "accent",
  "secondary",
  "info",
  "success",
  "warning",
];

export class AgentNameFormatter {
  capitalize(name: string): string {
    if (name.length === 0) return "";
    const first = name.charAt(0);
    const upper = first.toUpperCase();
    return upper + name.slice(1);
  }

  color(name: string): AgentColor {
    let hash = 5381;
    for (let i = 0; i < name.length; i++) {
      hash = ((hash << 5) + hash + name.charCodeAt(i)) | 0;
    }
    const index = Math.abs(hash) % PALETTE.length;
    return PALETTE[index];
  }
}

export const agentNameFormatter = new AgentNameFormatter();
