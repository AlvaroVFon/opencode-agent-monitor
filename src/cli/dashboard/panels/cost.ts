import type { DashboardPanel } from "../dashboard.types";
import type { DashboardData } from "../dashboard.types";
import { escapeHtml } from "../dashboard-helpers";
import { COST_PANEL_TEMPLATE } from "../templates/panels/cost";

type CostPanelData = {
  hasData: boolean;
  content: string;
  emptyMessage: string;
};

export const costPanel: DashboardPanel<CostPanelData> = {
  id: "cost",
  title: "Cost",
  gridClass: "",

  dataProvider: (data: DashboardData): CostPanelData => {
    if (data.costs.length === 0) {
      return {
        hasData: false,
        content: "",
        emptyMessage: "No cost data",
      };
    }

    // Build the cost chart canvas — data is injected via the chart script
    const canvasHtml = '<canvas id="costChart" height="200"></canvas>';
    return {
      hasData: true,
      content: canvasHtml,
      emptyMessage: "",
    };
  },

  templateSource: COST_PANEL_TEMPLATE,
};
