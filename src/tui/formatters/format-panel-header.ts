export function formatPanelHeader(
  collapsed: boolean,
  totalCost: string,
): { indicator: string; title: string; totalCost: string } {
  return {
    indicator: collapsed ? "▸" : "▾",
    title: "Agents Monitor",
    totalCost,
  };
}

export function toggleCollapsed(current: boolean): boolean {
  return !current;
}
