import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { applyPalette } from "../../cli/dashboard/templates/theme-toggle";

/**
 * A stub chart representing the minimal Chart.js instance surface
 * that applyPalette needs to interact with.
 */
function stubChart(
  datasets: Array<{
    backgroundColor?: string | string[];
    borderColor?: string | string[];
  }>,
): {
  config: { data: { datasets: typeof datasets } };
  update: (mode: string) => void;
  calledWith: string[];
} {
  const calledWith: string[] = [];
  return {
    config: { data: { datasets } },
    update(mode: string) {
      calledWith.push(mode);
    },
    calledWith,
  };
}

describe("applyPalette()", () => {
  it("overwrites dataset.backgroundColor from palette categories", () => {
    const chart = stubChart([
      { backgroundColor: "red" },
      { backgroundColor: "blue" },
    ]);
    const palette = {
      categories: ["#3b82f6", "#10b981", "#f59e0b"],
      primary: "",
      input: "",
      output: "",
      reasoning: "",
    };

    applyPalette(chart as any, palette);

    const ds = chart.config.data.datasets;
    assert.equal(ds[0].backgroundColor, "#3b82f6");
    assert.equal(ds[1].backgroundColor, "#10b981");
  });

  it("overwrites dataset.borderColor when present", () => {
    const chart = stubChart([
      { backgroundColor: "red", borderColor: "red" },
      { backgroundColor: "blue", borderColor: "blue" },
    ]);
    const palette = {
      categories: ["#3b82f6", "#10b981"],
      primary: "",
      input: "",
      output: "",
      reasoning: "",
    };

    applyPalette(chart as any, palette);

    const ds = chart.config.data.datasets;
    assert.equal(ds[0].borderColor, "#3b82f6");
    assert.equal(ds[1].borderColor, "#10b981");
  });

  it("calls chart.update('none') after recoloring", () => {
    const chart = stubChart([{ backgroundColor: "red" }]);
    const palette = {
      categories: ["#3b82f6"],
      primary: "",
      input: "",
      output: "",
      reasoning: "",
    };

    applyPalette(chart as any, palette);

    assert.deepEqual(chart.calledWith, ["none"]);
  });

  it("cycles through palette categories when more datasets than colors", () => {
    const chart = stubChart([
      { backgroundColor: "a" },
      { backgroundColor: "b" },
      { backgroundColor: "c" },
    ]);
    const palette = {
      categories: ["#1", "#2"],
      primary: "",
      input: "",
      output: "",
      reasoning: "",
    };

    applyPalette(chart as any, palette);

    const ds = chart.config.data.datasets;
    assert.equal(ds[0].backgroundColor, "#1");
    assert.equal(ds[1].backgroundColor, "#2");
    assert.equal(ds[2].backgroundColor, "#1"); // cycles back to #1
  });

  it("does not touch borderColor when dataset has none", () => {
    const chart = stubChart([{ backgroundColor: "red" }]);
    const palette = {
      categories: ["#3b82f6"],
      primary: "",
      input: "",
      output: "",
      reasoning: "",
    };

    applyPalette(chart as any, palette);

    const ds = chart.config.data.datasets;
    assert.equal(ds[0].backgroundColor, "#3b82f6");
    assert.equal(ds[0].borderColor, undefined);
  });
});
