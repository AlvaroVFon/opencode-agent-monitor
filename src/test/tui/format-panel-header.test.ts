import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  formatPanelHeader,
  toggleCollapsed,
} from "../../tui/formatters/format-panel-header";

// ---------------------------------------------------------------------------
// formatPanelHeader — title-row content for the panel header
// ---------------------------------------------------------------------------
//
// Per the spec, the panel header shows three pieces of information:
//   - a collapse indicator ("▾" expanded, "▸" collapsed)
//   - a fixed title string ("Agent Monitor")
//   - the formatted total cost, echoed verbatim
//
// The helper is a pure function: no I/O, no side effects, no string mutation
// of the cost input. These tests pin the contract for the implementer.

describe("formatPanelHeader", () => {
  it("expanded: returns '▾' indicator, 'Agent Monitor' title, echoed totalCost", () => {
    // The canonical example from the spec:
    //   formatPanelHeader(false, "$0.0234")
    //     === { indicator: "▾", title: "Agent Monitor", totalCost: "$0.0234" }
    const header = formatPanelHeader(false, "$0.0234");

    assert.deepEqual(
      header,
      { indicator: "▾", title: "Agent Monitor", totalCost: "$0.0234" },
      "expanded header must use the down-pointing indicator and the fixed title",
    );
  });

  it("collapsed: returns '▸' indicator, 'Agent Monitor' title, echoed totalCost", () => {
    // The canonical example from the spec:
    //   formatPanelHeader(true, "$0.0234")
    //     === { indicator: "▸", title: "Agent Monitor", totalCost: "$0.0234" }
    const header = formatPanelHeader(true, "$0.0234");

    assert.deepEqual(
      header,
      { indicator: "▸", title: "Agent Monitor", totalCost: "$0.0234" },
      "collapsed header must use the right-pointing indicator and the fixed title",
    );
  });

  it("title is always 'Agent Monitor' regardless of collapsed", () => {
    // Acceptance criterion 8: header text must remain 'Agent Monitor' in
    // both states. We check both states explicitly so a future refactor that
    // accidentally couples the title to the indicator cannot pass.
    const expanded = formatPanelHeader(false, "$1.0000");
    const collapsed = formatPanelHeader(true, "$1.0000");

    assert.equal(
      expanded.title,
      "Agent Monitor",
      "title must be 'Agent Monitor' when expanded",
    );
    assert.equal(
      collapsed.title,
      "Agent Monitor",
      "title must be 'Agent Monitor' when collapsed",
    );
  });

  it("totalCost is echoed exactly as provided (verifies no formatting mutation)", () => {
    // The spec is explicit: `totalCost` in the returned object is the
    // formatted cost string passed in, NOT re-formatted by the helper. We
    // feed it a few representative inputs and assert exact equality.
    const inputs = [
      "$0.0000",
      "$0.0234",
      "$12.3456",
      "$1,234.5678",
      // Edge case: a string that is NOT a valid cost format. The helper
      // must still pass it through verbatim — it is the caller's job to
      // pre-format.
      "n/a",
      "",
    ];

    for (const cost of inputs) {
      const expanded = formatPanelHeader(false, cost);
      const collapsed = formatPanelHeader(true, cost);

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

  it("returns an object with exactly the three documented keys", () => {
    // Pin the return-shape contract. The keys are `indicator`, `title`,
    // `totalCost`; nothing more, nothing less. This guards against a
    // well-meaning future PR that adds (e.g.) a `key` field for v-for
    // purposes and accidentally couples it to the indicator.
    const header = formatPanelHeader(false, "$0.0234");

    assert.equal(
      typeof header,
      "object",
      "formatPanelHeader must return an object",
    );
    assert.ok(header !== null, "returned value must not be null");
    const keys = Object.keys(header).sort();
    assert.deepEqual(
      keys,
      ["indicator", "title", "totalCost"],
      "returned object must have exactly the three documented keys",
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
  it("toggleCollapsed(false) returns true", () => {
    assert.equal(
      toggleCollapsed(false),
      true,
      "toggling an expanded panel must yield a collapsed panel",
    );
  });

  it("toggleCollapsed(true) returns false", () => {
    assert.equal(
      toggleCollapsed(true),
      false,
      "toggling a collapsed panel must yield an expanded panel",
    );
  });

  it("double-toggle returns to original", () => {
    // A toggle is its own inverse: applying it twice must return the
    // starting value, for both possible starting values. This is the
    // canonical property test for any involution-like helper.
    assert.equal(
      toggleCollapsed(toggleCollapsed(false)),
      false,
      "toggling expanded twice must return to expanded",
    );
    assert.equal(
      toggleCollapsed(toggleCollapsed(true)),
      true,
      "toggling collapsed twice must return to collapsed",
    );
  });
});
