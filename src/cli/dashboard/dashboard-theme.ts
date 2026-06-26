import type { DashboardTheme } from "./dashboard.types";

// ── Built-in themes ─────────────────────────────────────────────────────────

export const lightTheme: DashboardTheme = {
  name: "light",
  cssVars: {
    "--dashboard-bg": "#f3f4f6",
    "--dashboard-text": "#111827",
    "--dashboard-text-secondary": "#6b7280",
    "--dashboard-card-bg": "#ffffff",
    "--dashboard-border": "#e5e7eb",
    "--dashboard-heading": "#1f2937",
    "--dashboard-muted": "#9ca3af",
    "--dashboard-accent": "#3b82f6",
    "--dashboard-success": "#10b981",
    "--dashboard-warning": "#f59e0b",
    "--dashboard-error": "#ef4444",
  },
  chartPalette: {
    primary: "#3b82f6",
    input: "#3b82f6",
    output: "#10b981",
    reasoning: "#f59e0b",
    categories: [
      "#3b82f6",
      "#10b981",
      "#f59e0b",
      "#ef4444",
      "#8b5cf6",
      "#ec4899",
      "#0ea5e9",
      "#a8a29e",
    ],
  },
};

export const darkTheme: DashboardTheme = {
  name: "dark",
  cssVars: {
    "--dashboard-bg": "#111827",
    "--dashboard-text": "#f9fafb",
    "--dashboard-text-secondary": "#9ca3af",
    "--dashboard-card-bg": "#1f2937",
    "--dashboard-border": "#374151",
    "--dashboard-heading": "#f3f4f6",
    "--dashboard-muted": "#6b7280",
    "--dashboard-accent": "#60a5fa",
    "--dashboard-success": "#34d399",
    "--dashboard-warning": "#fbbf24",
    "--dashboard-error": "#f87171",
  },
  chartPalette: {
    primary: "#60a5fa",
    input: "#60a5fa",
    output: "#34d399",
    reasoning: "#fbbf24",
    categories: [
      "#60a5fa",
      "#34d399",
      "#fbbf24",
      "#f87171",
      "#a78bfa",
      "#f472b6",
      "#38bdf8",
      "#a8a29e",
    ],
  },
};

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Convert a DashboardTheme's CSS custom properties to a CSS variable block.
 * Returns a string suitable for embedding in a `<style>` tag.
 */
export function cssVars(theme: DashboardTheme): string {
  return Object.entries(theme.cssVars)
    .map(([key, value]) => `  ${key}: ${value};`)
    .join("\n");
}

/**
 * Resolve theme name from an explicit preference with a default fallback.
 *
 * @param preference - explicit theme name, or `null` if no preference stored
 * @returns the resolved theme name — `"light"` when no preference is given
 */
export function resolveThemeName(
  preference: "light" | "dark" | null,
): "light" | "dark" {
  return preference ?? "light";
}

// ── Registry ────────────────────────────────────────────────────────────────

export const themeRegistry = new Map<string, DashboardTheme>([
  ["light", lightTheme],
  ["dark", darkTheme],
]);
