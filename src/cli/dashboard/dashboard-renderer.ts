/**
 * Dashboard Renderer — thin façade over DashboardEngine.
 *
 * Creates an engine singleton pre-configured with all shared partials,
 * the default panel set, and chart script template. Exists so that
 * existing consumers (CLI dashboard command, existing tests) continue
 * to work with the same `dashboardRenderer.render(data)` API.
 *
 * The engine handles all actual rendering; this module just owns the
 * bootstrap wiring.
 */
import { DashboardEngine } from "./dashboard-engine";
import { defaultPanels } from "./panels/index";
import { CHART_SCRIPT_TEMPLATE } from "./templates/panels/chart-script";
import {
  CARD_TEMPLATE,
  TABLE_TEMPLATE,
  EMPTY_STATE_TEMPLATE,
} from "./templates/index";

import type { DashboardData } from "./dashboard.types";

/**
 * Pre-configured renderer singleton.
 *
 * The engine is wired at construction time with shared partials, the
 * default panel registry, and the chart script source. Each call to
 * `render(data, opts)` delegates to `engine.render(data, opts)`.
 */
export const dashboardRenderer = new (class {
  readonly engine: DashboardEngine;

  constructor() {
    this.engine = new DashboardEngine();

    this.engine.compilePartials({
      card: CARD_TEMPLATE,
      table: TABLE_TEMPLATE,
      "empty-state": EMPTY_STATE_TEMPLATE,
    });

    this.engine.chartScriptSource = CHART_SCRIPT_TEMPLATE;

    for (const panel of defaultPanels) {
      this.engine.registerPanel(panel);
    }
  }

  render(data: DashboardData, opts?: { theme?: "light" | "dark" }): string {
    return this.engine.render(data, opts);
  }
})();
