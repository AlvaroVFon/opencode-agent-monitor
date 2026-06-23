import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  lightTheme,
  darkTheme,
  cssVars,
  themeRegistry,
  resolveThemeName,
} from "../../cli/dashboard/dashboard-theme";
import { THEME_TOGGLE_SCRIPT } from "../../cli/dashboard/templates/theme-toggle";

describe("DashboardTheme", () => {
  describe("theme objects", () => {
    it("lightTheme has expected shape", () => {
      assert.equal(lightTheme.name, "light");
      assert.ok(lightTheme.cssVars["--dashboard-bg"]);
      assert.ok(lightTheme.cssVars["--dashboard-text"]);
      assert.ok(lightTheme.cssVars["--dashboard-card-bg"]);
      assert.ok(lightTheme.cssVars["--dashboard-border"]);
      assert.ok(Array.isArray(lightTheme.chartPalette.categories));
      assert.equal(typeof lightTheme.chartPalette.primary, "string");
    });

    it("darkTheme has expected shape", () => {
      assert.equal(darkTheme.name, "dark");
      assert.ok(darkTheme.cssVars["--dashboard-bg"]);
      assert.ok(darkTheme.cssVars["--dashboard-text"]);
      assert.ok(darkTheme.cssVars["--dashboard-card-bg"]);
      assert.ok(darkTheme.cssVars["--dashboard-border"]);
      assert.ok(Array.isArray(darkTheme.chartPalette.categories));
      assert.equal(typeof darkTheme.chartPalette.primary, "string");
    });

    it("light and dark themes differ in background color", () => {
      assert.notEqual(
        lightTheme.cssVars["--dashboard-bg"],
        darkTheme.cssVars["--dashboard-bg"],
      );
    });
  });

  describe("cssVars()", () => {
    it("returns CSS variable declarations from a theme", () => {
      const vars = cssVars(lightTheme);
      assert.ok(vars.includes("--dashboard-bg"));
      assert.ok(vars.includes(lightTheme.cssVars["--dashboard-bg"]));
    });

    it("returns different output for light vs dark", () => {
      const light = cssVars(lightTheme);
      const dark = cssVars(darkTheme);
      assert.notEqual(light, dark);
    });

    it("each line has the format '--name: value;'", () => {
      const vars = cssVars(lightTheme);
      const lines = vars.trim().split("\n");
      for (const line of lines) {
        assert.match(line, /^\s*--[\w-]+:\s*.+;\s*$/);
      }
    });
  });

  describe("themeRegistry", () => {
    it("contains both light and dark themes", () => {
      assert.ok(themeRegistry.has("light"));
      assert.ok(themeRegistry.has("dark"));
      assert.equal(themeRegistry.size, 2);
    });

    it("maps theme name to theme object", () => {
      assert.equal(themeRegistry.get("light")?.name, "light");
      assert.equal(themeRegistry.get("dark")?.name, "dark");
    });
  });

  describe("resolveThemeName()", () => {
    it("returns 'light' for explicit light preference", () => {
      assert.equal(resolveThemeName("light"), "light");
    });

    it("returns 'dark' for explicit dark preference", () => {
      assert.equal(resolveThemeName("dark"), "dark");
    });

    it("returns 'light' when no preference is given (default)", () => {
      assert.equal(resolveThemeName(null), "light");
    });
  });

  describe("THEME_TOGGLE_SCRIPT", () => {
    it("contains localStorage dashboard-theme key", () => {
      assert.ok(
        THEME_TOGGLE_SCRIPT.includes("dashboard-theme"),
        "should reference the localStorage key",
      );
    });

    it("contains matchMedia prefers-color-scheme fallback", () => {
      assert.ok(
        THEME_TOGGLE_SCRIPT.includes("matchMedia"),
        "should use matchMedia for no-preference fallback",
      );
      assert.ok(
        THEME_TOGGLE_SCRIPT.includes("prefers-color-scheme"),
        "should query prefers-color-scheme media query",
      );
    });

    it("contains window.__charts iteration for palette swap", () => {
      assert.ok(
        THEME_TOGGLE_SCRIPT.includes("__charts"),
        "should reference __charts array",
      );
    });

    it("contains setProperty calls on documentElement for CSS vars", () => {
      assert.ok(
        THEME_TOGGLE_SCRIPT.includes("setProperty"),
        "should set CSS custom properties on documentElement",
      );
    });

    it("wraps content in script tags", () => {
      assert.ok(
        THEME_TOGGLE_SCRIPT.startsWith("<script>"),
        "should start with script tag",
      );
      assert.ok(
        THEME_TOGGLE_SCRIPT.endsWith("</script>"),
        "should end with closing script tag",
      );
    });

    it("includes chart.update call for recoloring", () => {
      assert.ok(
        THEME_TOGGLE_SCRIPT.includes("update("),
        "should call chart.update for re-rendering",
      );
    });
  });
});
