import { describe, it } from "node:test";
import assert from "node:assert/strict";
import Handlebars from "handlebars";
import { DashboardEngine } from "../../cli/dashboard/dashboard-engine";
import { darkTheme } from "../../cli/dashboard/dashboard-theme";
import type {
  DashboardPanel,
  DashboardData,
} from "../../cli/dashboard/dashboard.types";

describe("DashboardEngine", () => {
  describe("constructor", () => {
    it("creates a Handlebars instance", () => {
      const engine = new DashboardEngine();
      assert.ok(engine.hbs);
      assert.equal(typeof engine.hbs.compile, "function");
    });

    it("initialises with an empty panel registry", () => {
      const engine = new DashboardEngine();
      assert.ok(engine.registry instanceof Map);
      assert.equal(engine.registry.size, 0);
    });
  });

  describe("compilePartials()", () => {
    it("compiles valid partials and registers them", () => {
      const engine = new DashboardEngine();
      const partials = {
        card: '<div class="card">{{title}}</div>',
        table: "<table>{{{rows}}}</table>",
      };

      engine.compilePartials(partials);

      // Verify partials are registered by rendering via a template that uses them
      const tpl = engine.hbs.compile(
        "{{> card title=title}}{{> table rows=rows}}",
      );
      const html = tpl(
        { title: "Cost", rows: "<tr><td>data</td></tr>" },
        {
          partials: {
            card: engine.hbs.partials.card as Handlebars.TemplateDelegate,
            table: engine.hbs.partials.table as Handlebars.TemplateDelegate,
          },
        },
      );
      assert.ok(html.includes("Cost"));
      assert.ok(html.includes("data"));
    });

    it("catches syntax errors and registers a div placeholder instead of crashing", () => {
      const engine = new DashboardEngine();
      const partials = {
        bad: "{{#if broken",
        good: "<p>{{message}}</p>",
      };

      assert.doesNotThrow(() => engine.compilePartials(partials));

      // The good partial should still work
      const goodTpl = engine.hbs.compile("{{> good}}");
      const goodHtml = goodTpl(
        { message: "hello" },
        {
          partials: {
            good: engine.hbs.partials.good as Handlebars.TemplateDelegate,
          },
        },
      );
      assert.ok(goodHtml.includes("hello"));

      // The bad partial should render as a div placeholder
      const badTpl = engine.hbs.compile("{{> bad}}");
      const badHtml = badTpl(
        {},
        {
          partials: {
            bad: engine.hbs.partials.bad as Handlebars.TemplateDelegate,
          },
        },
      );
      assert.ok(badHtml.includes("partial-error") || badHtml.includes("div"));
    });
  });

  describe("registerPanel()", () => {
    it("adds a panel to the registry", () => {
      const engine = new DashboardEngine();
      const panel: DashboardPanel<{ value: number }> = {
        id: "cost",
        title: "Cost",
        dataProvider: (data: DashboardData) => ({ value: data.sessionCount }),
        template: Handlebars.compile("{{data.value}}"),
        gridClass: "md:col-span-1",
      };

      engine.registerPanel(panel);
      assert.equal(engine.registry.size, 1);
      assert.ok(engine.registry.has("cost"));
    });

    it("maintains insertion order of registered panels", () => {
      const engine = new DashboardEngine();
      const panelA: DashboardPanel<null> = {
        id: "metrics",
        title: "Metrics",
        dataProvider: () => null,
        template: Handlebars.compile("metrics"),
        gridClass: "md:col-span-1",
      };
      const panelB: DashboardPanel<null> = {
        id: "chart",
        title: "Chart",
        dataProvider: () => null,
        template: Handlebars.compile("chart"),
        gridClass: "md:col-span-1",
      };
      const panelC: DashboardPanel<null> = {
        id: "log",
        title: "Log",
        dataProvider: () => null,
        template: Handlebars.compile("log"),
        gridClass: "md:col-span-1",
      };

      engine.registerPanel(panelA);
      engine.registerPanel(panelB);
      engine.registerPanel(panelC);

      const ids = [...engine.registry.keys()];
      assert.deepEqual(ids, ["metrics", "chart", "log"]);
    });
  });

  describe("render() with theme option", () => {
    const sampleData: DashboardData = {
      generatedAt: 1719000000000,
      sessionCount: 1,
      costs: [{ sessionID: "ses-1", total: 0.01, byModel: { "gpt-4o": 0.01 } }],
      tokens: [{ sessionID: "ses-1", input: 100, output: 50, reasoning: 10 }],
      tools: [{ name: "read_file", calls: 1, errors: 0, durationMs: 100 }],
      skills: [],
      timeline: [
        {
          sessionID: "ses-1",
          type: "session_created",
          durationMs: 0,
          timestamp: 100,
        },
      ],
      errors: [],
      isEmpty: false,
    };

    it("defaults to light theme when no theme option is passed", () => {
      const engine = new DashboardEngine();
      const html = engine.render(sampleData);
      // Light theme CSS vars include #f3f4f6 for bg
      assert.ok(html.includes("#f3f4f6"), "light bg in default render");
      assert.ok(html.includes("#111827"), "light text color");
    });

    it('renders dark palette CSS vars with { theme: "dark" }', () => {
      const engine = new DashboardEngine();
      const html = engine.render(sampleData, { theme: "dark" });
      // Dark theme CSS vars include #111827 for bg
      assert.ok(html.includes("#111827"), "dark bg in style block");
      assert.ok(html.includes("#f9fafb"), "dark text color");
    });

    it("uses the dark theme chart palette values", () => {
      const engine = new DashboardEngine();
      const html = engine.render(sampleData, { theme: "dark" });
      // The dark theme chartPalette primary should be referenced in the output
      assert.ok(
        html.includes(darkTheme.chartPalette.primary),
        "dark chart palette primary present",
      );
    });

    it("includes theme toggle script in output", () => {
      const engine = new DashboardEngine();
      const html = engine.render(sampleData);
      assert.ok(
        html.includes("dashboard-theme"),
        "theme toggle localStorage key in output",
      );
      assert.ok(html.includes("__toggleTheme"), "toggle function exposed");
    });
  });
});
