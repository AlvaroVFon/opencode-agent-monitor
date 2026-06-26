import Handlebars from "handlebars";
import type {
  DashboardPanel,
  DashboardData,
  DashboardTheme,
} from "./dashboard.types";
import { themeRegistry, resolveThemeName, cssVars } from "./dashboard-theme";
import { LAYOUT_TEMPLATE } from "./templates/layout";
import { THEME_TOGGLE_SCRIPT } from "./templates/theme-toggle";
import { escapeHtml } from "./dashboard-helpers";

/**
 * Dashboard rendering engine.
 *
 * Owns a scoped Handlebars instance, a panel registry (Map), and a
 * compilePartials() method that pre-compiles shared partials at bootstrap
 * time. Malformed partials are caught and registered as a `<div>`
 * placeholder instead of crashing the process.
 *
 * Call render(data, opts) to produce a complete HTML document from the
 * registered panels.
 */
export class DashboardEngine {
  readonly hbs: typeof Handlebars;
  readonly registry: Map<string, DashboardPanel<any>>;

  /**
   * Optional chart script template source — rendered with chart data
   * and injected into the layout's scripts section when data is present.
   */
  chartScriptSource?: string;

  constructor() {
    this.hbs = Handlebars.create();
    this.registry = new Map();
  }

  /**
   * Pre-compile a set of named partial templates.
   *
   * Malformed templates (syntax errors) are caught and registered as
   * a simple `<div class="partial-error">` placeholder so the renderer
   * can continue without crashing.
   */
  compilePartials(partials: Record<string, string>): void {
    for (const [name, source] of Object.entries(partials)) {
      try {
        const fn = this.hbs.compile(source);
        // Render with an empty context to surface syntax errors at
        // registration time rather than at render time.
        fn({});
        this.hbs.registerPartial(name, fn);
      } catch {
        this.hbs.registerPartial(name, '<div class="partial-error"></div>');
      }
    }
  }

  /**
   * Register a panel in the registry.
   * Panels are rendered in registration order (Map insertion order).
   */
  registerPanel(panel: DashboardPanel<any>): void {
    this.registry.set(panel.id, panel);
  }

  /**
   * Render a complete HTML dashboard document.
   *
   * Iterates the panel registry in registration order, renders each
   * panel's template via the scoped Handlebars instance, wraps each
   * in a card with the panel's grid class, encloses all cards in a
   * responsive grid, and injects the result into the layout template
   * together with chart scripts and CSS custom properties (theme).
   *
   * @param data - DashboardData from DashboardAggregator.build()
   * @param opts - Optional render options (theme name)
   * @returns A complete HTML document string
   */
  render(data: DashboardData, opts?: { theme?: "light" | "dark" }): string {
    const themeName = resolveThemeName(opts?.theme ?? null);
    const theme = themeRegistry.get(themeName) ?? themeRegistry.get("light")!;

    if (data.isEmpty) {
      return this.renderEmptyShell(theme);
    }

    // ── Render panels ──────────────────────────────────────────────────
    const cards: string[] = [];

    for (const panel of this.registry.values()) {
      const panelData = panel.dataProvider(data);
      const ctx = {
        data: panelData,
        theme,
        helpers: {
          fmt: (n: number) => n.toLocaleString("en-US"),
          fmtCost: (n: number) => `$${n.toFixed(4)}`,
          escapeHtml,
        },
      };

      const fn = this.hbs.compile(panel.templateSource);
      const contentHtml = fn(ctx);

      const gridClass = panel.gridClass ? ` ${panel.gridClass}` : "";
      const cardHtml = `<div class="rounded-lg bg-white p-6 shadow${gridClass}">
  <h2 class="mb-4 text-xl font-semibold text-gray-800">${escapeHtml(panel.title)}</h2>
  ${contentHtml}
</div>`;
      cards.push(cardHtml);
    }

    const panelsHtml = `<div class="grid grid-cols-1 gap-6 md:grid-cols-2">
${cards.join("\n")}
</div>`;

    // ── Render chart script ────────────────────────────────────────────
    let scriptsHtml = THEME_TOGGLE_SCRIPT;

    if (this.chartScriptSource && !data.isEmpty) {
      const allToolSkills = [...data.tools, ...data.skills];
      const chartFn = this.hbs.compile(this.chartScriptSource);
      scriptsHtml += chartFn({
        costLabelsJson: JSON.stringify(data.costs.map((c) => c.sessionID)),
        costDataJson: JSON.stringify(data.costs),
        tokenLabelsJson: JSON.stringify(data.tokens.map((t) => t.sessionID)),
        tokenInputJson: JSON.stringify(data.tokens.map((t) => t.input)),
        tokenOutputJson: JSON.stringify(data.tokens.map((t) => t.output)),
        tokenReasoningJson: JSON.stringify(data.tokens.map((t) => t.reasoning)),
        toolLabelsJson: JSON.stringify(allToolSkills.map((r) => r.name)),
        toolCallsJson: JSON.stringify(allToolSkills.map((r) => r.calls)),
      });
    }

    // ── Render layout ──────────────────────────────────────────────────
    const layoutFn = this.hbs.compile(LAYOUT_TEMPLATE);
    return layoutFn({
      title: "Agent Monitor Dashboard",
      summary: `Generated from ${data.sessionCount} session(s) · ${data.generatedAt > 0 ? new Date(data.generatedAt).toISOString() : ""}`,
      styles: cssVars(theme),
      panels: panelsHtml,
      scripts: scriptsHtml,
    });
  }

  /** Render the empty state when there is no session data. */
  private renderEmptyShell(theme: DashboardTheme): string {
    const emptyPanel = `<div class="rounded-lg bg-white p-12 text-center shadow">
  <p class="text-lg text-gray-500">No session data</p>
  <p class="mt-2 text-sm text-gray-400">Run the agent to generate trace data, then re-run the dashboard command.</p>
</div>`;

    const layoutFn = this.hbs.compile(LAYOUT_TEMPLATE);
    return layoutFn({
      title: "Agent Monitor Dashboard",
      summary: "",
      styles: cssVars(theme),
      panels: emptyPanel,
      scripts: THEME_TOGGLE_SCRIPT,
    });
  }
}
