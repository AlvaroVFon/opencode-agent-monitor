import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DashboardEngine } from "../../../cli/dashboard/dashboard-engine";
import { defaultPanels } from "../../../cli/dashboard/panels/index";
import { CHART_SCRIPT_TEMPLATE } from "../../../cli/dashboard/templates/panels/chart-script";
import {
  CARD_TEMPLATE,
  TABLE_TEMPLATE,
  EMPTY_STATE_TEMPLATE,
} from "../../../cli/dashboard/templates/index";
import type { DashboardData } from "../../../cli/dashboard/dashboard.types";

// ── Test data helpers ─────────────────────────────────────────────────────

function emptyData(): DashboardData {
  return {
    generatedAt: 1719000000000,
    sessionCount: 0,
    costs: [],
    tokens: [],
    tools: [],
    skills: [],
    timeline: [],
    errors: [],
    isEmpty: true,
  };
}

function sampleData(overrides?: Partial<DashboardData>): DashboardData {
  return {
    generatedAt: 1719000000000,
    sessionCount: 2,
    costs: [
      {
        sessionID: "ses-1",
        total: 0.05,
        byModel: { "gpt-4o": 0.02, "claude-3.5": 0.03 },
      },
      { sessionID: "ses-2", total: 0.01, byModel: { "gpt-4o": 0.01 } },
    ],
    tokens: [
      { sessionID: "ses-1", input: 130, output: 70, reasoning: 5 },
      { sessionID: "ses-2", input: 200, output: 100, reasoning: 50 },
    ],
    tools: [
      { name: "read_file", calls: 3, errors: 1, durationMs: 600 },
      { name: "write_file", calls: 1, errors: 1, durationMs: 50 },
    ],
    skills: [
      { name: "analyze_code", calls: 2, errors: 1, durationMs: 700 },
      { name: "generate_docs", calls: 1, errors: 0, durationMs: 300 },
    ],
    timeline: [
      {
        sessionID: "ses-1",
        type: "session_created",
        durationMs: 0,
        timestamp: 100,
      },
      { sessionID: "ses-1", type: "llm_call", durationMs: 500, timestamp: 200 },
    ],
    errors: [
      { tool: "read_file", message: "File not found", sessions: ["ses-1"] },
    ],
    isEmpty: false,
    ...overrides,
  };
}

// ── Set up engine once ────────────────────────────────────────────────────

function createEngine(): DashboardEngine {
  const engine = new DashboardEngine();

  // Register shared partials
  engine.compilePartials({
    card: CARD_TEMPLATE,
    table: TABLE_TEMPLATE,
    "empty-state": EMPTY_STATE_TEMPLATE,
  });

  // Register chart script
  engine.chartScriptSource = CHART_SCRIPT_TEMPLATE;

  // Register all panels
  for (const panel of defaultPanels) {
    engine.registerPanel(panel);
  }

  return engine;
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe("Default panels", () => {
  describe("Registration order", () => {
    it("defaultPanels exports panels in the correct order", () => {
      const ids = defaultPanels.map((p) => p.id);
      assert.deepEqual(ids, [
        "cost",
        "tokens",
        "tools-skills",
        "timeline",
        "event-metrics",
        "errors",
      ]);
    });

    it("engine renders panels in registration order", () => {
      const engine = createEngine();
      const data = sampleData();
      const html = engine.render(data);

      // The HTML output must contain panel content in registration order.
      // Verify each panel heading appears after the previous one.
      // Use the <h2> panel heading element to avoid matching the same word
      // in other contexts (e.g. "Errors" table header column in Tools & Skills).
      const costIdx = html.indexOf(">Cost</h2>");
      const tokensIdx = html.indexOf(">Tokens</h2>");
      const toolsIdx = html.indexOf(">Tools &amp; Skills</h2>");
      const timelineIdx = html.indexOf(">Timeline</h2>");
      const eventMetricsIdx = html.indexOf(">Event Metrics</h2>");
      const errorsIdx = html.indexOf(">Errors</h2>");

      assert.ok(costIdx < tokensIdx, "Cost panel appears before Tokens");
      assert.ok(
        tokensIdx < toolsIdx,
        "Tokens panel appears before Tools & Skills",
      );
      assert.ok(
        toolsIdx < timelineIdx,
        "Tools & Skills panel appears before Timeline",
      );
      assert.ok(
        timelineIdx < eventMetricsIdx,
        "Timeline panel appears before Event Metrics",
      );
      assert.ok(
        eventMetricsIdx < errorsIdx,
        "Event Metrics panel appears before Errors",
      );
    });
  });

  describe("Cost panel", () => {
    it("renders canvas with costChart id when there is cost data", () => {
      const engine = createEngine();
      const html = engine.render(sampleData());
      assert.ok(
        html.includes('id="costChart"'),
        "cost canvas present with data",
      );
    });

    it("shows 'No cost data' message when cost array is empty", () => {
      const engine = createEngine();
      const html = engine.render(
        sampleData({
          costs: [],
          tokens: [],
          tools: [],
          skills: [],
          timeline: [],
          errors: [],
          isEmpty: false,
        }),
      );
      assert.ok(html.includes("No cost data"), "empty cost message shown");
    });
  });

  describe("Tokens panel", () => {
    it("renders canvas with tokenChart id when there is token data", () => {
      const engine = createEngine();
      const html = engine.render(sampleData());
      assert.ok(
        html.includes('id="tokenChart"'),
        "token canvas present with data",
      );
    });

    it("shows 'No token data' message when token array is empty", () => {
      const engine = createEngine();
      const html = engine.render(
        sampleData({
          tokens: [],
          costs: [],
          tools: [],
          skills: [],
          timeline: [],
          errors: [],
          isEmpty: false,
        }),
      );
      assert.ok(html.includes("No token data"), "empty token message shown");
    });
  });

  describe("Tools & Skills panel", () => {
    it("renders doughnut canvas with toolsChart id when there is data", () => {
      const engine = createEngine();
      const html = engine.render(sampleData());
      assert.ok(
        html.includes('id="toolsChart"'),
        "tools canvas present with data",
      );
    });

    it("renders tool names in the table", () => {
      const engine = createEngine();
      const html = engine.render(sampleData());
      assert.ok(html.includes("read_file"), "first tool name in output");
      assert.ok(html.includes("write_file"), "second tool name in output");
    });

    it("shows 'No tool or skill data' message when both arrays are empty", () => {
      const engine = createEngine();
      const html = engine.render(
        sampleData({
          tools: [],
          skills: [],
          costs: [],
          tokens: [],
          timeline: [],
          errors: [],
          isEmpty: false,
        }),
      );
      assert.ok(
        html.includes("No tool or skill data"),
        "empty tools message shown",
      );
    });

    it("escapes HTML in tool name to prevent XSS", () => {
      const engine = createEngine();
      const data = sampleData({
        tools: [
          {
            name: "<script>alert('xss')</script>",
            calls: 1,
            errors: 0,
            durationMs: 100,
          },
        ],
        skills: [],
        errors: [],
      });
      const html = engine.render(data);
      // The escaped form MUST appear in the HTML body
      assert.ok(
        html.includes("&lt;script&gt;alert(&#39;xss&#39;)&lt;/script&gt;"),
        "escaped script tag should appear in panel body",
      );
    });
  });

  describe("Timeline panel", () => {
    it("renders session groups for timeline data", () => {
      const engine = createEngine();
      const html = engine.render(sampleData());
      assert.ok(html.includes("ses-1"), "first session in timeline output");
    });

    it("renders event types in timeline groups", () => {
      const engine = createEngine();
      const html = engine.render(sampleData());
      assert.ok(
        html.includes("session_created"),
        "session_created event shown",
      );
      assert.ok(html.includes("llm_call"), "llm_call event shown");
    });

    it("shows 'No timeline data' message when timeline is empty", () => {
      const engine = createEngine();
      const html = engine.render(
        sampleData({
          timeline: [],
          costs: [],
          tokens: [],
          tools: [],
          skills: [],
          errors: [],
          isEmpty: false,
        }),
      );
      assert.ok(
        html.includes("No timeline data"),
        "empty timeline message shown",
      );
    });

    it("escapes HTML in sessionID", () => {
      const engine = createEngine();
      const data = sampleData({
        costs: [],
        tokens: [],
        tools: [],
        skills: [],
        errors: [],
        timeline: [
          {
            sessionID: "<div onclick='evil()'>malicious</div>",
            type: "llm_call",
            durationMs: 500,
            timestamp: 100,
          },
        ],
      });
      const html = engine.render(data);
      assert.ok(
        html.includes(
          "&lt;div onclick=&#39;evil()&#39;&gt;malicious&lt;/div&gt;",
        ),
        "sessionID with HTML should be escaped in Timeline panel",
      );
    });
  });

  describe("Errors panel", () => {
    it("renders error table with tool and message", () => {
      const engine = createEngine();
      const html = engine.render(sampleData());
      assert.ok(html.includes("read_file"), "failing tool in errors");
      assert.ok(html.includes("File not found"), "error message in errors");
    });

    it("renders affected sessions", () => {
      const engine = createEngine();
      const html = engine.render(sampleData());
      assert.ok(html.includes("ses-1"), "affected session in errors");
    });

    it("shows 'No errors detected' when errors array is empty", () => {
      const engine = createEngine();
      const html = engine.render(
        sampleData({
          errors: [],
          costs: [],
          tokens: [],
          tools: [],
          skills: [],
          timeline: [],
          isEmpty: false,
        }),
      );
      assert.ok(
        html.includes("No errors detected"),
        "empty errors message shown",
      );
    });

    it("escapes HTML in error message", () => {
      const engine = createEngine();
      const data = sampleData({
        errors: [
          {
            tool: "read_file",
            message: "Error: <img src=x onerror=alert(1)>",
            sessions: ["ses-1"],
          },
        ],
      });
      const html = engine.render(data);
      assert.ok(
        html.includes("&lt;img src=x onerror=alert(1)&gt;"),
        "HTML-like error message should be escaped",
      );
    });

    it("handles error with multiple affected sessions", () => {
      const engine = createEngine();
      const data = sampleData({
        errors: [
          {
            tool: "db_query",
            message: "Timeout",
            sessions: ["ses-1", "ses-2", "ses-3"],
          },
        ],
      });
      const html = engine.render(data);
      assert.ok(html.includes("Timeout"), "error message present");
      assert.ok(
        html.includes("ses-1, ses-2, ses-3"),
        "all affected sessions listed",
      );
    });
  });

  describe("Engine render", () => {
    it("shows 'No session data' when data is empty", () => {
      const engine = createEngine();
      const html = engine.render(emptyData());
      assert.ok(html.includes("No session data"));
    });

    it("includes Tailwind CSS CDN link", () => {
      const engine = createEngine();
      const html = engine.render(sampleData());
      assert.ok(html.includes("cdn.tailwindcss.com"));
    });

    it("includes Chart.js CDN script tag", () => {
      const engine = createEngine();
      const html = engine.render(sampleData());
      assert.ok(
        html.includes("cdn.jsdelivr.net/npm/chart.js"),
        "should reference chart.js CDN",
      );
    });

    it("renders all 6 panel headings for non-empty data", () => {
      const engine = createEngine();
      const html = engine.render(sampleData());
      const panels = [
        "Cost",
        "Tokens",
        "Tools &amp; Skills",
        "Timeline",
        "Event Metrics",
        "Errors",
      ];
      for (const panel of panels) {
        assert.ok(
          html.includes(panel),
          `panel heading "${panel}" should be present`,
        );
      }
    });

    it("includes Chart.js configuration with cost data", () => {
      const engine = createEngine();
      const html = engine.render(sampleData());
      assert.ok(html.includes("0.05"), "should contain ses-1 total cost");
      assert.ok(html.includes("0.01"), "should contain ses-2 total cost");
    });

    it("includes Chart.js configuration with token data", () => {
      const engine = createEngine();
      const html = engine.render(sampleData());
      assert.ok(html.includes("130"), "should contain ses-1 input tokens");
      assert.ok(html.includes("70"), "should contain ses-1 output tokens");
      assert.ok(html.includes("200"), "should contain ses-2 input tokens");
    });

    it("includes doughnut chart data for tools/skills distribution", () => {
      const engine = createEngine();
      const html = engine.render(sampleData());
      assert.ok(html.includes("doughnut"), "should use doughnut chart type");
      assert.ok(
        html.includes("read_file"),
        "should include tool name in chart data",
      );
      assert.ok(html.includes("write_file"), "should include second tool name");
    });

    it("formats session count in header summary", () => {
      const engine = createEngine();
      const html = engine.render(sampleData({ sessionCount: 5 }));
      assert.ok(
        html.includes("5 session(s)"),
        "should show session count in header",
      );
    });

    it("produces valid HTML shell structure", () => {
      const engine = createEngine();
      const html = engine.render(sampleData());
      assert.ok(
        html.startsWith("<!DOCTYPE html>"),
        "should start with DOCTYPE",
      );
      assert.ok(html.includes("<html"), "should have html tag");
      assert.ok(html.includes("</html>"), "should close html tag");
      assert.ok(html.includes("<head>"), "should have head section");
      assert.ok(html.includes("</head>"), "should close head");
      assert.ok(html.includes("<body"), "should have body tag");
      assert.ok(html.includes("</body>"), "should close body");
    });

    it("renders CDN script tags even for empty data", () => {
      const engine = createEngine();
      const html = engine.render(emptyData());
      assert.ok(html.includes("No session data"), "empty message present");
      assert.ok(
        html.includes("cdn.tailwindcss.com"),
        "Tailwind CDN present in empty shell",
      );
    });
  });

  describe("Event Metrics panel", () => {
    it("renders type counts table when timeline has events", () => {
      const engine = createEngine();
      const data = sampleData();
      const html = engine.render(data);
      assert.ok(html.includes("Events by Type"), "type counts section heading");
      assert.ok(html.includes("session_created"), "event type in metrics");
      assert.ok(html.includes("llm_call"), "event type in metrics");
    });

    it("renders top 5 slowest events list", () => {
      const engine = createEngine();
      const data = sampleData();
      const html = engine.render(data);
      assert.ok(html.includes("Top 5 Slowest Events"), "top 5 section heading");
    });

    it("shows 'No events recorded' when timeline is empty", () => {
      const engine = createEngine();
      const data = sampleData({
        timeline: [],
        costs: [],
        tokens: [],
        tools: [],
        skills: [],
        errors: [],
      });
      const html = engine.render(data);
      assert.ok(
        html.includes("No events recorded"),
        "empty events message shown",
      );
    });
  });

  describe("Chart script", () => {
    it("references all three datasets in emitted script", () => {
      const engine = createEngine();
      const html = engine.render(sampleData());
      assert.ok(html.includes("costChart"), "cost chart reference");
      assert.ok(html.includes("tokenChart"), "token chart reference");
      assert.ok(html.includes("toolsChart"), "tools chart reference");
    });

    it("pushes charts to window.__charts", () => {
      const engine = createEngine();
      const html = engine.render(sampleData());
      assert.ok(html.includes("window.__charts"), "window.__charts in output");
      assert.ok(
        html.includes("__charts.push"),
        "charts are pushed to __charts",
      );
    });

    it("does not emit chart script for empty data", () => {
      const engine = createEngine();
      const html = engine.render(emptyData());
      // The theme toggle script always references __charts, but the chart
      // initialisation script (with __charts.push) should NOT appear for empty data.
      assert.ok(
        !html.includes("__charts.push"),
        "no chart init script for empty data",
      );
      assert.ok(!html.includes("costChart"), "no chart cost for empty data");
    });
  });
});
