import { describe, it } from "node:test";
import assert from "node:assert/strict";
import Handlebars from "handlebars";
import {
  LAYOUT_TEMPLATE,
  CARD_TEMPLATE,
  TABLE_TEMPLATE,
  EMPTY_STATE_TEMPLATE,
} from "../../cli/dashboard/templates/index";

describe("Dashboard templates", () => {
  describe("LAYOUT_TEMPLATE", () => {
    it("compiles via Handlebars.compile without error", () => {
      const tpl = Handlebars.compile(LAYOUT_TEMPLATE);
      assert.equal(typeof tpl, "function");
    });

    it("renders with panels, styles, and scripts", () => {
      const tpl = Handlebars.compile(LAYOUT_TEMPLATE);
      const html = tpl({
        panels: '<div class="panel">Content</div>',
        styles: ":root { --bg: #fff; }",
        scripts: 'console.log("ok");',
        summary: "2 sessions",
        title: "Agent Monitor Dashboard",
      });
      assert.ok(html.includes("!DOCTYPE html"));
      assert.ok(html.includes("Agent Monitor Dashboard"));
      assert.ok(html.includes('<div class="panel">Content</div>'));
      assert.ok(html.includes("--bg: #fff"));
      assert.ok(html.includes('console.log("ok")'));
      assert.ok(html.includes("2 sessions"));
    });

    it("renders with empty optional sections", () => {
      const tpl = Handlebars.compile(LAYOUT_TEMPLATE);
      const html = tpl({
        panels: "",
        styles: "",
        scripts: "",
        summary: "",
        title: "Dashboard",
      });
      assert.ok(html.includes("Dashboard"));
    });
  });

  describe("CARD_TEMPLATE", () => {
    it("compiles without error", () => {
      const tpl = Handlebars.compile(CARD_TEMPLATE);
      assert.equal(typeof tpl, "function");
    });

    it("wraps content in a card with title", () => {
      const tpl = Handlebars.compile(CARD_TEMPLATE);
      const html = tpl({
        title: "Cost",
        content: '<canvas id="costChart"></canvas>',
      });
      assert.ok(html.includes("Cost"));
      assert.ok(html.includes('id="costChart"'));
    });
  });

  describe("TABLE_TEMPLATE", () => {
    it("compiles without error", () => {
      const tpl = Handlebars.compile(TABLE_TEMPLATE);
      assert.equal(typeof tpl, "function");
    });

    it("renders table headers and rows", () => {
      const tpl = Handlebars.compile(TABLE_TEMPLATE);
      const html = tpl({
        headers: "<th>Name</th><th>Calls</th>",
        rows: "<tr><td>read_file</td><td>3</td></tr>",
      });
      assert.ok(html.includes("<table"));
      assert.ok(html.includes("Name</th>"));
      assert.ok(html.includes("read_file"));
    });
  });

  describe("EMPTY_STATE_TEMPLATE", () => {
    it("compiles without error", () => {
      const tpl = Handlebars.compile(EMPTY_STATE_TEMPLATE);
      assert.equal(typeof tpl, "function");
    });

    it("renders a message and optional description", () => {
      const tpl = Handlebars.compile(EMPTY_STATE_TEMPLATE);
      const html = tpl({
        message: "No session data",
        description: "Run the agent to generate traces.",
      });
      assert.ok(html.includes("No session data"));
      assert.ok(html.includes("Run the agent to generate traces."));
    });

    it("renders without a description when omitted", () => {
      const tpl = Handlebars.compile(EMPTY_STATE_TEMPLATE);
      const html = tpl({ message: "No data" });
      assert.ok(html.includes("No data"));
    });
  });
});
