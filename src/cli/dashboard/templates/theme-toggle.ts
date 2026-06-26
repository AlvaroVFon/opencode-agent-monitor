/**
 * Apply a Chart.js palette to a chart instance by overwriting per-dataset
 * colors, then calling `update('none')`.
 *
 * Chart.js does not re-read `dataset.backgroundColor` from any external
 * palette reference on `update()`. Datasets retain their originally
 * assigned values, so overlays must overwrite them explicitly before
 * triggering a re-render.
 */
export function applyPalette(
  chart: {
    config: {
      data: {
        datasets: Array<{
          backgroundColor?: string | string[];
          borderColor?: string | string[];
        }>;
      };
    };
    update: (mode: string) => void;
  },
  palette: { categories: string[] },
): void {
  const { datasets } = chart.config.data;

  for (let i = 0; i < datasets.length; i++) {
    const color = palette.categories[i % palette.categories.length];
    const ds = datasets[i];
    ds.backgroundColor = color;
    if (ds.borderColor != null) {
      ds.borderColor = color;
    }
  }

  chart.update("none");
}

/**
 * Runtime theme toggle script for inlining in the HTML `<script>` tag.
 *
 * On load:
 * 1. Reads `localStorage` key `dashboard-theme`
 * 2. Falls back to `window.matchMedia('(prefers-color-scheme: dark)')` when no stored preference
 * 3. Applies CSS custom properties to `documentElement`
 * 4. Iterates `window.__charts` to recolor datasets and calls `chart.update('none')`
 *
 * Exposes `window.__toggleTheme()` to switch between light/dark and persist the choice.
 */
export const THEME_TOGGLE_SCRIPT = `<script>
(function() {
  var THEMES = {
    light: {
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
        "--dashboard-error": "#ef4444"
      },
      chartPalette: {
        categories: ["#3b82f6","#10b981","#f59e0b","#ef4444","#8b5cf6","#ec4899","#0ea5e9","#a8a29e"]
      }
    },
    dark: {
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
        "--dashboard-error": "#f87171"
      },
      chartPalette: {
        categories: ["#60a5fa","#34d399","#fbbf24","#f87171","#a78bfa","#f472b6","#38bdf8","#a8a29e"]
      }
    }
  };

  function getTheme() {
    var stored = localStorage.getItem("dashboard-theme");
    if (stored === "light" || stored === "dark") return stored;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }

  function applyTheme(themeName) {
    var theme = THEMES[themeName];
    if (!theme) return;
    for (var key in theme.cssVars) {
      document.documentElement.style.setProperty(key, theme.cssVars[key]);
    }
    (window.__charts || []).forEach(function(chart) {
      chart.config.data.datasets.forEach(function(ds, i) {
        var color = theme.chartPalette.categories[i % theme.chartPalette.categories.length];
        ds.backgroundColor = color;
        if (ds.borderColor != null) ds.borderColor = color;
      });
      chart.update("none");
    });
  }

  applyTheme(getTheme());

  window.__toggleTheme = function() {
    var current = getTheme();
    var next = current === "light" ? "dark" : "light";
    localStorage.setItem("dashboard-theme", next);
    applyTheme(next);
  };
})();
</script>`;
