/**
 * Chart.js inline script template.
 *
 * Produces a `<script>` block that creates Chart.js instances for the
 * cost (grouped bar by model), tokens (stacked bar), and tools/skills
 * (doughnut) canvases, and pushes every Chart instance to
 * `window.__charts` so the theme toggle can re-colour them.
 *
 * Data is injected as JSON-serialized parameters from the render
 * context. The template uses triple-stash ({{{ }}}) to embed JSON strings
 * directly in JavaScript context, which is safe because JSON.stringify
 * produces valid JS expressions.
 */
export const CHART_SCRIPT_TEMPLATE = `<script>
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

  var __charts = [];

  /* Cost chart — stacked bar by model per session */
  var costCtx = document.getElementById("costChart");
  if (costCtx) {
    var costs = {{{costDataJson}}};
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
    __charts.push(new Chart(costCtx, {
      type: "bar",
      data: { labels: {{{costLabelsJson}}}, datasets: datasets },
      options: {
        responsive: true,
        scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true, ticks: { callback: function(v) { return "$" + v.toFixed(4); } } } },
        plugins: { tooltip: { callbacks: { label: function(ctx) { return ctx.dataset.label + ": $" + ctx.parsed.y.toFixed(4); } } } }
      }
    }));
  }

  /* Token chart — stacked bar (input / output / reasoning) */
  var tokenCtx = document.getElementById("tokenChart");
  if (tokenCtx) {
    __charts.push(new Chart(tokenCtx, {
      type: "bar",
      data: {
        labels: {{{tokenLabelsJson}}},
        datasets: [
          { label: "Input", data: {{{tokenInputJson}}}, backgroundColor: "rgba(59,130,246,0.7)" },
          { label: "Output", data: {{{tokenOutputJson}}}, backgroundColor: "rgba(16,185,129,0.7)" },
          { label: "Reasoning", data: {{{tokenReasoningJson}}}, backgroundColor: "rgba(245,158,11,0.7)" }
        ]
      },
      options: {
        responsive: true,
        scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true } }
      }
    }));
  }

  /* Tools & Skills doughnut chart */
  var toolsCtx = document.getElementById("toolsChart");
  if (toolsCtx) {
    __charts.push(new Chart(toolsCtx, {
      type: "doughnut",
      data: {
        labels: {{{toolLabelsJson}}},
        datasets: [{
          data: {{{toolCallsJson}}},
          backgroundColor: [
            "rgba(59,130,246,0.7)", "rgba(16,185,129,0.7)", "rgba(245,158,11,0.7)",
            "rgba(239,68,68,0.7)", "rgba(139,92,246,0.7)", "rgba(236,72,153,0.7)",
            "rgba(14,165,233,0.7)", "rgba(168,162,158,0.7)"
          ]
        }]
      },
      options: { responsive: true, plugins: { legend: { position: "bottom" } } }
    }));
  }

  window.__charts = __charts;
})();
</script>`;
