export class PanelHeaderFormatter {
  format(
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

  toggleCollapsed(current: boolean): boolean {
    return !current;
  }
}

export const panelHeaderFormatter = new PanelHeaderFormatter();
