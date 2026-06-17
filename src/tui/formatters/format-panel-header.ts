export function formatPanelHeader(
  collapsed: boolean,
  totalCost: string,
  agentCount: number,
): {
  indicator: string;
  title: string;
  totalCost: string;
  agentCount: string;
} {
  return {
    indicator: collapsed ? "▸" : "▾",
    title: "Agents Monitor",
    totalCost,
    agentCount: agentCount > 0 ? `(${agentCount})` : "",
  };
}

export function toggleCollapsed(current: boolean): boolean {
  return !current;
}
