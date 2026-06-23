import type { DashboardPanel } from "../dashboard.types";
import type { DashboardData } from "../dashboard.types";
import { TOKENS_PANEL_TEMPLATE } from "../templates/panels/tokens";

type TokensPanelData = {
  hasData: boolean;
  content: string;
  emptyMessage: string;
};

export const tokensPanel: DashboardPanel<TokensPanelData> = {
  id: "tokens",
  title: "Tokens",
  gridClass: "",

  dataProvider: (data: DashboardData): TokensPanelData => {
    if (data.tokens.length === 0) {
      return {
        hasData: false,
        content: "",
        emptyMessage: "No token data",
      };
    }

    const canvasHtml = '<canvas id="tokenChart" height="200"></canvas>';
    return {
      hasData: true,
      content: canvasHtml,
      emptyMessage: "",
    };
  },

  templateSource: TOKENS_PANEL_TEMPLATE,
};
