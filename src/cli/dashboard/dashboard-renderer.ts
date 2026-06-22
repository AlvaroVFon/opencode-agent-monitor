/**
 * Dashboard Renderer — produces a self-contained HTML report string from
 * `DashboardData`.
 *
 * Pure logic, no I/O. Follows the string-template convention established by
 * `formatMarkdown`, `formatJson`, and `formatCsv` in `src/shared/formatters/`.
 *
 * Design decisions:
 * - Tailwind CSS + Chart.js load from CDN. Text + layout work without CDN;
 *   charts degrade gracefully when offline.
 * - Chart data is JSON-serialized and inlined in a `<script>` tag.
 *   Chart.js reads it client-side — no server-side rendering.
 * - `escapeHtml()` on ALL user-supplied strings (sessionID, tool names,
 *   skill names, error messages) prevents XSS.
 * - Empty data produces the same HTML shell with a "No session data" panel.
 */
import type {
  DashboardData,
  SessionCost,
  TokenBucket,
  ToolRow,
  TimelineRow,
  ErrorRow,
} from "./dashboard.types";

// ── Helpers ────────────────────────────────────────────────────────────────

/** Format a number with locale-aware thousands separators. */
function fmt(n: number): string {
  return n.toLocaleString("en-US");
}

/** Format a cost value as a dollar string. */
function fmtCost(n: number): string {
  return `$${n.toFixed(4)}`;
}

// ── Renderer ───────────────────────────────────────────────────────────────

export class DashboardRenderer {
  /**
   * HTML-escape a user-supplied string.
   *
   * Replaces &, <, >, ", and ' with their HTML entity equivalents.
   * Every user-supplied value that appears in the HTML output MUST pass
   * through this method.
   */
  private static escapeHtml(raw: string): string {
    return raw
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  /**
   * Produce a self-contained HTML report string.
   *
   * @param data - DashboardData from DashboardAggregator.build()
   * @returns A complete HTML document as a string
   */
  render(data: DashboardData): string {
    const panels = data.isEmpty ? this.renderEmpty() : this.renderPanels(data);
    const scripts = this.renderScripts(data);

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Agent Monitor Dashboard</title>
<script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gray-100 min-h-screen p-4 md:p-8">
<div class="mx-auto max-w-7xl">
  <h1 class="mb-8 text-3xl font-bold text-gray-900">Agent Monitor Dashboard</h1>
  ${data.isEmpty ? "" : `<p class="mb-6 text-sm text-gray-500">Generated from ${data.sessionCount} session(s) &middot; ${data.generatedAt > 0 ? new Date(data.generatedAt).toISOString() : ""}</p>`}
  ${panels}
</div>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.7/dist/chart.umd.min.js"></script>
${scripts}
</body>
</html>`;
  }

  // ── Empty state ───────────────────────────────────────────────────────────

  private renderEmpty(): string {
    return `<div class="rounded-lg bg-white p-12 text-center shadow">
  <p class="text-lg text-gray-500">No session data</p>
  <p class="mt-2 text-sm text-gray-400">Run the agent to generate trace data, then re-run the dashboard command.</p>
</div>`;
  }

  // ── Panels (non-empty) ────────────────────────────────────────────────────

  private renderPanels(data: DashboardData): string {
    const parts: string[] = [];

    parts.push(this.renderCostPanel(data.costs));
    parts.push(this.renderTokenPanel(data.tokens));
    parts.push(this.renderToolsSkillsPanel(data.tools, data.skills));
    parts.push(this.renderTimelinePanel(data.timeline));
    parts.push(this.renderErrorPanel(data.errors));

    return `<div class="grid grid-cols-1 gap-6 md:grid-cols-2">
${parts.join("\n")}
</div>`;
  }

  // ── Cost panel (bar chart per session) ────────────────────────────────────

  private renderCostPanel(costs: SessionCost[]): string {
    const rows =
      costs.length === 0
        ? '<p class="text-sm text-gray-400">No cost data</p>'
        : '<canvas id="costChart" height="200"></canvas>';

    return `  <div class="rounded-lg bg-white p-6 shadow">
    <h2 class="mb-4 text-xl font-semibold text-gray-800">Cost</h2>
    ${rows}
  </div>`;
  }

  // ── Token panel (stacked bar per session) ─────────────────────────────────

  private renderTokenPanel(tokens: TokenBucket[]): string {
    const rows =
      tokens.length === 0
        ? '<p class="text-sm text-gray-400">No token data</p>'
        : '<canvas id="tokenChart" height="200"></canvas>';

    return `  <div class="rounded-lg bg-white p-6 shadow">
    <h2 class="mb-4 text-xl font-semibold text-gray-800">Tokens</h2>
    ${rows}
  </div>`;
  }

  // ── Tools & Skills panel (table + doughnut chart) ─────────────────────────

  private renderToolsSkillsPanel(tools: ToolRow[], skills: ToolRow[]): string {
    const hasData = tools.length > 0 || skills.length > 0;

    if (!hasData) {
      return `  <div class="rounded-lg bg-white p-6 shadow md:col-span-2">
    <h2 class="mb-4 text-xl font-semibold text-gray-800">Tools &amp; Skills</h2>
    <p class="text-sm text-gray-400">No tool or skill data</p>
  </div>`;
    }

    const allRows = [...tools, ...skills];
    const rows = allRows
      .map(
        (r) =>
          `<tr>
  <td class="whitespace-nowrap px-4 py-2 text-sm text-gray-900">${DashboardRenderer.escapeHtml(r.name)}</td>
  <td class="px-4 py-2 text-sm text-gray-700">${fmt(r.calls)}</td>
  <td class="px-4 py-2 text-sm text-gray-700">${fmt(r.errors)}</td>
  <td class="px-4 py-2 text-sm text-gray-700">${fmt(r.durationMs)}ms</td>
  <td class="px-4 py-2 text-sm text-gray-700">${r.cost != null ? fmtCost(r.cost) : "—"}</td>
</tr>`,
      )
      .join("\n");

    return `  <div class="rounded-lg bg-white p-6 shadow md:col-span-2">
    <h2 class="mb-4 text-xl font-semibold text-gray-800">Tools &amp; Skills</h2>
    <div class="mb-6" style="max-width:300px">
      <canvas id="toolsChart" height="300"></canvas>
    </div>
    <div class="overflow-x-auto">
      <table class="w-full text-left text-sm">
        <thead>
          <tr class="border-b border-gray-200">
            <th class="px-4 py-2 font-medium text-gray-600">Name</th>
            <th class="px-4 py-2 font-medium text-gray-600">Calls</th>
            <th class="px-4 py-2 font-medium text-gray-600">Errors</th>
            <th class="px-4 py-2 font-medium text-gray-600">Duration</th>
            <th class="px-4 py-2 font-medium text-gray-600">Cost</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100">
${rows}
        </tbody>
      </table>
    </div>
  </div>`;
  }

  // ── Timeline panel (chronological event list per session) ─────────────────

  private renderTimelinePanel(timeline: TimelineRow[]): string {
    if (timeline.length === 0) {
      return `  <div class="rounded-lg bg-white p-6 shadow md:col-span-2">
    <h2 class="mb-4 text-xl font-semibold text-gray-800">Timeline</h2>
    <p class="text-sm text-gray-400">No timeline data</p>
  </div>`;
    }

    // Group by sessionID, maintaining chronological order (already sorted by
    // DashboardAggregator).
    const bySession = new Map<string, TimelineRow[]>();
    for (const row of timeline) {
      const group = bySession.get(row.sessionID) ?? [];
      group.push(row);
      bySession.set(row.sessionID, group);
    }

    const sessionBlocks: string[] = [];
    for (const [sessionID, rows] of bySession) {
      const items = rows
        .map(
          (r) =>
            `<div class="flex items-center justify-between border-b border-gray-100 py-2 text-sm">
  <div class="flex items-center gap-2">
    <span class="inline-block h-2 w-2 rounded-full bg-blue-400"></span>
    <span class="text-gray-700">${DashboardRenderer.escapeHtml(r.type)}</span>
  </div>
  <span class="text-gray-500">${r.durationMs > 0 ? `${fmt(r.durationMs)}ms` : "—"}</span>
</div>`,
        )
        .join("\n");

      sessionBlocks.push(`<div class="mb-4">
  <h3 class="mb-2 text-sm font-semibold text-gray-600">${DashboardRenderer.escapeHtml(sessionID)}</h3>
  ${items}
</div>`);
    }

    return `  <div class="rounded-lg bg-white p-6 shadow md:col-span-2">
    <h2 class="mb-4 text-xl font-semibold text-gray-800">Timeline</h2>
    ${sessionBlocks.join("\n")}
  </div>`;
  }

  // ── Error panel (table) ───────────────────────────────────────────────────

  private renderErrorPanel(errors: ErrorRow[]): string {
    if (errors.length === 0) {
      return `  <div class="rounded-lg bg-white p-6 shadow md:col-span-2">
    <h2 class="mb-4 text-xl font-semibold text-gray-800">Errors</h2>
    <p class="text-sm text-gray-400">No errors detected</p>
  </div>`;
    }

    const rows = errors
      .map(
        (e) =>
          `<tr>
  <td class="whitespace-nowrap px-4 py-2 text-sm text-gray-900">${DashboardRenderer.escapeHtml(e.tool)}</td>
  <td class="px-4 py-2 text-sm text-gray-700">${DashboardRenderer.escapeHtml(e.message)}</td>
  <td class="px-4 py-2 text-sm text-gray-700">${DashboardRenderer.escapeHtml(e.sessions.join(", "))}</td>
</tr>`,
      )
      .join("\n");

    return `  <div class="rounded-lg bg-white p-6 shadow md:col-span-2">
    <h2 class="mb-4 text-xl font-semibold text-gray-800">Errors</h2>
    <div class="overflow-x-auto">
      <table class="w-full text-left text-sm">
        <thead>
          <tr class="border-b border-gray-200">
            <th class="px-4 py-2 font-medium text-gray-600">Tool</th>
            <th class="px-4 py-2 font-medium text-gray-600">Message</th>
            <th class="px-4 py-2 font-medium text-gray-600">Sessions</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100">
${rows}
        </tbody>
      </table>
    </div>
  </div>`;
  }

  // ── Chart.js inline script ────────────────────────────────────────────────

  private renderScripts(data: DashboardData): string {
    if (data.isEmpty) return "";

    const costLabels = JSON.stringify(data.costs.map((c) => c.sessionID));
    const costData = JSON.stringify(data.costs);

    const tokenLabels = JSON.stringify(data.tokens.map((t) => t.sessionID));
    const tokenInput = JSON.stringify(data.tokens.map((t) => t.input));
    const tokenOutput = JSON.stringify(data.tokens.map((t) => t.output));
    const tokenReasoning = JSON.stringify(data.tokens.map((t) => t.reasoning));

    const allRows = [...data.tools, ...data.skills];
    const toolLabels = JSON.stringify(allRows.map((r) => r.name));
    const toolCalls = JSON.stringify(allRows.map((r) => r.calls));

    return `<script>
(function() {
  var MODEL_COLORS = {
    "gpt-4o": "rgba(59,130,246,0.8)", "gpt-4o-mini": "rgba(96,165,250,0.8)",
    "gpt-4": "rgba(37,99,235,0.8)", "gpt-3.5-turbo": "rgba(147,197,253,0.8)",
    "claude-3.5": "rgba(16,185,129,0.8)", "claude-3": "rgba(52,211,153,0.8)",
    "claude-opus": "rgba(5,150,105,0.8)",
    "deepseek": "rgba(245,158,11,0.8)", "deepseek-r1": "rgba(251,191,36,0.8)",
    "default": "rgba(168,162,158,0.8)"
  };
  function modelColor(m) { return MODEL_COLORS[m] || MODEL_COLORS["default"]; }

  /* ── Cost chart (stacked by model) ── */
  var costCtx = document.getElementById("costChart");
  if (costCtx) {
    var costs = ${costData};
    var models = [...new Set(costs.flatMap(function(c) { return Object.keys(c.byModel); }))];
    if (models.length === 0) { models = ["(no data)"]; }
    var datasets = models.map(function(m) {
      return {
        label: m,
        data: costs.map(function(c) { return c.byModel[m] || 0; }),
        backgroundColor: modelColor(m),
        borderWidth: 1
      };
    });
    new Chart(costCtx, {
      type: "bar",
      data: { labels: ${costLabels}, datasets: datasets },
      options: {
        responsive: true,
        scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true, ticks: { callback: function(v) { return "$" + v.toFixed(4); } } } },
        plugins: { tooltip: { callbacks: { label: function(ctx) { return ctx.dataset.label + ": $" + ctx.parsed.y.toFixed(4); } } } }
      }
    });
  }

  /* ── Token chart ── */
  var tokenCtx = document.getElementById("tokenChart");
  if (tokenCtx) {
    new Chart(tokenCtx, {
      type: "bar",
      data: {
        labels: ${tokenLabels},
        datasets: [
          { label: "Input", data: ${tokenInput}, backgroundColor: "rgba(59,130,246,0.7)" },
          { label: "Output", data: ${tokenOutput}, backgroundColor: "rgba(16,185,129,0.7)" },
          { label: "Reasoning", data: ${tokenReasoning}, backgroundColor: "rgba(245,158,11,0.7)" }
        ]
      },
      options: {
        responsive: true,
        scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true } }
      }
    });
  }

  /* ── Tools & Skills doughnut chart ── */
  var toolsCtx = document.getElementById("toolsChart");
  if (toolsCtx) {
    new Chart(toolsCtx, {
      type: "doughnut",
      data: {
        labels: ${toolLabels},
        datasets: [{
          data: ${toolCalls},
          backgroundColor: [
            "rgba(59,130,246,0.7)",
            "rgba(16,185,129,0.7)",
            "rgba(245,158,11,0.7)",
            "rgba(239,68,68,0.7)",
            "rgba(139,92,246,0.7)",
            "rgba(236,72,153,0.7)",
            "rgba(14,165,233,0.7)",
            "rgba(168,162,158,0.7)"
          ]
        }]
      },
      options: { responsive: true, plugins: { legend: { position: "bottom" } } }
    });
  }
})();
</script>`;
  }
}

export const dashboardRenderer = new DashboardRenderer();
