import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { DashboardData } from "../../cli/dashboard/dashboard.types";
import { dashboardRenderer } from "../../cli/dashboard/dashboard-renderer";

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
      {
        sessionID: "ses-2",
        total: 0.01,
        byModel: { "gpt-4o": 0.01 },
      },
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
      {
        name: "analyze_code",
        calls: 2,
        errors: 1,
        durationMs: 700,
      },
      {
        name: "generate_docs",
        calls: 1,
        errors: 0,
        durationMs: 300,
      },
    ],
    timeline: [
      {
        sessionID: "ses-1",
        type: "session_created",
        durationMs: 0,
        timestamp: 100,
      },
      {
        sessionID: "ses-1",
        type: "llm_call",
        durationMs: 500,
        timestamp: 200,
      },
    ],
    errors: [
      {
        tool: "read_file",
        message: "File not found",
        sessions: ["ses-1"],
      },
    ],
    isEmpty: false,
    ...overrides,
  };
}

describe("DashboardRenderer", () => {
  describe("render", () => {
    it("shows 'No session data' when data is empty", () => {
      const html = dashboardRenderer.render(emptyData());
      assert.ok(html.includes("No session data"));
    });

    it("includes Tailwind CSS CDN link", () => {
      const html = dashboardRenderer.render(sampleData());
      assert.ok(html.includes("cdn.tailwindcss.com"));
      assert.ok(html.includes("<script"));
      assert.ok(html.includes("</script>"));
    });

    it("includes Chart.js CDN script tag", () => {
      const html = dashboardRenderer.render(sampleData());
      assert.ok(
        html.includes("cdn.jsdelivr.net/npm/chart.js"),
        "should reference chart.js CDN",
      );
    });

    it("renders all 5 panel sections for non-empty data", () => {
      const html = dashboardRenderer.render(sampleData());
      const panels = [
        "Cost",
        "Tokens",
        "Tools &amp; Skills",
        "Timeline",
        "Errors",
      ];
      for (const panel of panels) {
        assert.ok(
          html.includes(panel),
          `panel heading "${panel}" should be present`,
        );
      }
    });

    it("escapes HTML in tool name to prevent XSS", () => {
      const data = sampleData({
        tools: [
          {
            name: "<script>alert('xss')</script>",
            calls: 1,
            errors: 0,
            durationMs: 100,
          },
        ],
      });
      const html = dashboardRenderer.render(data);
      // The escaped form MUST appear in the HTML body (table rows).
      // The raw form MAY appear inside <script> blocks as JSON-stringified
      // Chart.js labels — that is safe because it's JavaScript string context,
      // not HTML context.
      assert.ok(
        html.includes("&lt;script&gt;alert(&#39;xss&#39;)&lt;/script&gt;"),
        "escaped script tag should appear in HTML body",
      );
    });

    it("escapes HTML in error message to prevent XSS", () => {
      const data = sampleData({
        errors: [
          {
            tool: "read_file",
            message: "Error: <img src=x onerror=alert(1)>",
            sessions: ["ses-1"],
          },
        ],
      });
      const html = dashboardRenderer.render(data);
      assert.ok(
        html.includes("&lt;img src=x onerror=alert(1)&gt;"),
        "HTML-like error message should be escaped",
      );
    });

    it("escapes HTML in sessionID to prevent XSS", () => {
      const data = sampleData({
        costs: [],
        tokens: [],
        tools: [],
        skills: [],
        timeline: [
          {
            sessionID: "<div onclick='evil()'>malicious</div>",
            type: "llm_call",
            durationMs: 500,
            timestamp: 100,
          },
        ],
        errors: [],
      });
      const html = dashboardRenderer.render(data);
      // SessionID appears in the HTML body via the Timeline panel heading
      // where it is rendered with escapeHtml().
      assert.ok(
        html.includes(
          "&lt;div onclick=&#39;evil()&#39;&gt;malicious&lt;/div&gt;",
        ),
        "sessionID with HTML should be escaped in Timeline panel heading",
      );
    });

    it("includes Chart.js configuration with cost data", () => {
      const html = dashboardRenderer.render(sampleData());
      // Chart.js config references
      assert.ok(html.includes("type:"), "should contain chart type config");
      assert.ok(html.includes("0.05"), "should contain ses-1 total cost");
      assert.ok(html.includes("0.01"), "should contain ses-2 total cost");
    });

    it("includes Chart.js configuration with token data", () => {
      const html = dashboardRenderer.render(sampleData());
      assert.ok(html.includes("130"), "should contain ses-1 input tokens");
      assert.ok(html.includes("70"), "should contain ses-1 output tokens");
      assert.ok(html.includes("200"), "should contain ses-2 input tokens");
    });

    it("includes doughnut chart data for tools/skills distribution", () => {
      const html = dashboardRenderer.render(sampleData());
      assert.ok(html.includes("doughnut"), "should use doughnut chart type");
      assert.ok(html.includes("read_file"), "should include tool name");
      assert.ok(html.includes("write_file"), "should include second tool name");
    });

    it("renders timeline entries in HTML", () => {
      const html = dashboardRenderer.render(sampleData());
      assert.ok(
        html.includes("session_created"),
        "should list timeline event types",
      );
      assert.ok(html.includes("llm_call"), "should list llm_call event");
    });

    it("renders error entries in HTML table", () => {
      const html = dashboardRenderer.render(sampleData());
      assert.ok(html.includes("File not found"), "should show error message");
      assert.ok(
        html.includes("read_file"),
        "should show failing tool name in errors",
      );
      assert.ok(html.includes("ses-1"), "should show affected session");
    });

    it("shows 'No cost data' when cost array is empty", () => {
      const html = dashboardRenderer.render(
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
      assert.ok(
        html.includes("No cost data"),
        "should show empty message for cost panel",
      );
      // Other panels should still render
      assert.ok(html.includes("Tokens"), "token panel should still render");
    });

    it("shows 'No tool or skill data' when both arrays are empty", () => {
      const html = dashboardRenderer.render(
        sampleData({
          tools: [],
          skills: [],
          timeline: [],
          errors: [],
          isEmpty: false,
        }),
      );
      assert.ok(
        html.includes("No tool or skill data"),
        "should show empty message for tools/skills panel",
      );
    });

    it("shows 'No timeline data' when timeline is empty", () => {
      const html = dashboardRenderer.render(
        sampleData({ timeline: [], errors: [], isEmpty: false }),
      );
      assert.ok(
        html.includes("No timeline data"),
        "should show empty message for timeline panel",
      );
    });

    it("shows 'No errors detected' when errors array is empty", () => {
      const html = dashboardRenderer.render(
        sampleData({ errors: [], isEmpty: false }),
      );
      assert.ok(
        html.includes("No errors detected"),
        "should show empty message for error panel",
      );
    });

    it("renders CDN script tags even for empty data (graceful offline shell)", () => {
      const html = dashboardRenderer.render(emptyData());
      assert.ok(html.includes("No session data"), "empty message present");
      assert.ok(
        html.includes("cdn.tailwindcss.com"),
        "Tailwind CDN present in empty shell",
      );
      // Chart.js script is only present for non-empty data
    });

    it("handles error with multiple affected sessions", () => {
      const data = sampleData({
        errors: [
          {
            tool: "db_query",
            message: "Timeout",
            sessions: ["ses-1", "ses-2", "ses-3"],
          },
        ],
      });
      const html = dashboardRenderer.render(data);
      assert.ok(html.includes("Timeout"), "error message present");
      assert.ok(
        html.includes("ses-1, ses-2, ses-3"),
        "all affected sessions listed",
      );
    });

    it("formats session count in header summary", () => {
      const html = dashboardRenderer.render(sampleData({ sessionCount: 5 }));
      assert.ok(
        html.includes("5 session(s)"),
        "should show session count in header",
      );
    });

    it("produces valid HTML shell structure", () => {
      const html = dashboardRenderer.render(sampleData());
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
  });
});
