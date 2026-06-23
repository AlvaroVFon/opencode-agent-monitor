import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type {
  DashboardData,
  PanelContext,
} from "../../cli/dashboard/dashboard.types";

describe("Dashboard types", () => {
  describe("PanelContext<T> shape", () => {
    it("exposes data, theme, and helpers for a typed context", () => {
      const ctx: PanelContext<{ value: number }> = {
        data: { value: 42 },
        theme: {
          name: "light" as const,
          cssVars: { "--dashboard-bg": "#fff" },
          chartPalette: {
            primary: "#3b82f6",
            input: "#3b82f6",
            output: "#10b981",
            reasoning: "#f59e0b",
            categories: ["#3b82f6", "#10b981", "#f59e0b"],
          },
        },
        helpers: {
          fmt: (n: number) => n.toLocaleString("en-US"),
          fmtCost: (n: number) => `$${n.toFixed(4)}`,
          escapeHtml: (s: string) =>
            s
              .replace(/&/g, "&amp;")
              .replace(/</g, "&lt;")
              .replace(/>/g, "&gt;")
              .replace(/"/g, "&quot;")
              .replace(/'/g, "&#39;"),
        },
      };

      assert.equal(ctx.data.value, 42);
      assert.equal(ctx.theme.name, "light");
      assert.equal(ctx.theme.cssVars["--dashboard-bg"], "#fff");
      assert.equal(ctx.theme.chartPalette.primary, "#3b82f6");
      assert.equal(ctx.theme.chartPalette.input, "#3b82f6");
      assert.equal(ctx.theme.chartPalette.output, "#10b981");
      assert.equal(ctx.theme.chartPalette.reasoning, "#f59e0b");
      assert.ok(Array.isArray(ctx.theme.chartPalette.categories));
      assert.equal(typeof ctx.helpers.fmt, "function");
      assert.equal(typeof ctx.helpers.fmtCost, "function");
      assert.equal(typeof ctx.helpers.escapeHtml, "function");

      assert.equal(ctx.helpers.fmt(1000), "1,000");
      assert.equal(ctx.helpers.fmtCost(0.05), "$0.0500");
      assert.equal(ctx.helpers.escapeHtml("<script>"), "&lt;script&gt;");
    });

    it("accepts a PanelContext with record data shape", () => {
      const ctx: PanelContext<Record<string, number>> = {
        data: { a: 1, b: 2 },
        theme: {
          name: "dark" as const,
          cssVars: { "--dashboard-bg": "#000" },
          chartPalette: {
            primary: "#000",
            input: "#000",
            output: "#000",
            reasoning: "#000",
            categories: [],
          },
        },
        helpers: {
          fmt: (n: number) => String(n),
          fmtCost: (n: number) => `$${n}`,
          escapeHtml: (s: string) => s,
        },
      };

      assert.equal(ctx.data.a, 1);
      assert.equal(ctx.data.b, 2);
      assert.equal(ctx.theme.name, "dark");
    });
  });
});
