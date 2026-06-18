import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { panelHeaderFormatter } from "../../tui/formatters/panel-header.formatter";

// ---------------------------------------------------------------------------
// formatPanelHeader — title-row content for the panel header
// ---------------------------------------------------------------------------
//
// Per the spec, the panel header shows:
//   - a collapse indicator ("▾" expanded, "▸" collapsed)
//   - a fixed title string ("Agents Monitor")
//   - the formatted total cost, echoed verbatim
//   - an agent count badge (e.g. "(3)") when > 0, empty string otherwise
//
// The helper is a pure function: no I/O, no side effects, no string mutation
// of the cost input. These tests pin the contract for the implementer.

describe("formatPanelHeader", () => {
  it("expanded: returns '▾' indicator, 'Agents Monitor' title, echoed totalCost", () => {
    const header = panelHeaderFormatter.format(false, "$0.0234", 3);

    assert.deepEqual(
      header,
      {
        indicator: "▾",
        title: "Agents Monitor",
        totalCost: "$0.0234",
        agentCount: "(3)",
      },
      "expanded header must use the down-pointing indicator and the fixed title",
    );
  });

  it("collapsed: returns '▸' indicator, 'Agents Monitor' title, echoed totalCost", () => {
    const header = panelHeaderFormatter.format(true, "$0.0234", 3);

    assert.deepEqual(
      header,
      {
        indicator: "▸",
        title: "Agents Monitor",
        totalCost: "$0.0234",
        agentCount: "(3)",
      },
      "collapsed header must use the right-pointing indicator and the fixed title",
    );
  });

  it("title is always 'Agents Monitor' regardless of collapsed", () => {
    const expanded = panelHeaderFormatter.format(false, "$1.0000", 0);
    const collapsed = panelHeaderFormatter.format(true, "$1.0000", 0);

    assert.equal(
      expanded.title,
      "Agents Monitor",
      "title must be 'Agents Monitor' when expanded",
    );
    assert.equal(
      collapsed.title,
      "Agents Monitor",
      "title must be 'Agents Monitor' when collapsed",
    );
  });

  it("totalCost is echoed exactly as provided (verifies no formatting mutation)", () => {
    const inputs = ["$0.0000", "$0.0234", "$12.3456", "$1,234.5678", "n/a", ""];

    for (const cost of inputs) {
      const expanded = panelHeaderFormatter.format(false, cost, 0);
      const collapsed = panelHeaderFormatter.format(true, cost, 0);

      assert.equal(
        expanded.totalCost,
        cost,
        `expanded totalCost must echo input ${JSON.stringify(cost)} verbatim`,
      );
      assert.equal(
        collapsed.totalCost,
        cost,
        `collapsed totalCost must echo input ${JSON.stringify(cost)} verbatim`,
      );
    }
  });

  it("agentCount is empty string when count is 0", () => {
    const header = panelHeaderFormatter.format(false, "$0.0000", 0);
    assert.equal(
      header.agentCount,
      "",
      "agentCount must be empty when 0 agents",
    );
  });

  it("agentCount shows badge when count > 0", () => {
    const header = panelHeaderFormatter.format(false, "$0.0000", 5);
    assert.equal(
      header.agentCount,
      "(5)",
      "agentCount must show (count) when agents > 0",
    );
  });

  it("returns an object with exactly the four documented keys", () => {
    const header = panelHeaderFormatter.format(false, "$0.0234", 0);

    assert.equal(
      typeof header,
      "object",
      "formatPanelHeader must return an object",
    );
    assert.ok(header !== null, "returned value must not be null");
    const keys = Object.keys(header).sort();
    assert.deepEqual(
      keys,
      ["agentCount", "indicator", "title", "totalCost"],
      "returned object must have exactly the four documented keys",
    );
  });
});

// ---------------------------------------------------------------------------
// toggleCollapsed — boolean toggle helper
// ---------------------------------------------------------------------------
//
// The helper exists so the toggle semantics are unit-testable independently
// of Solid. It is the boolean complement of its input.

describe("toggleCollapsed", () => {
  it("panelHeaderFormatter.toggleCollapsed(false) returns true", () => {
    assert.equal(
      panelHeaderFormatter.toggleCollapsed(false),
      true,
      "toggling an expanded panel must yield a collapsed panel",
    );
  });

  it("panelHeaderFormatter.toggleCollapsed(true) returns false", () => {
    assert.equal(
      panelHeaderFormatter.toggleCollapsed(true),
      false,
      "toggling a collapsed panel must yield an expanded panel",
    );
  });

  it("double-toggle returns to original", () => {
    // A toggle is its own inverse: applying it twice must return the
    // starting value, for both possible starting values. This is the
    // canonical property test for any involution-like helper.
    assert.equal(
      panelHeaderFormatter.toggleCollapsed(
        panelHeaderFormatter.toggleCollapsed(false),
      ),
      false,
      "toggling expanded twice must return to expanded",
    );
    assert.equal(
      panelHeaderFormatter.toggleCollapsed(
        panelHeaderFormatter.toggleCollapsed(true),
      ),
      true,
      "toggling collapsed twice must return to collapsed",
    );
  });
});
