import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  HUE_STEP,
  createV2PanelTheme,
  type PanelTheme,
} from "../../tui/theme.adapter";

/**
 * Minimal stand-in for the resolved OpenCode theme. Only the tokens the
 * adapter reads are populated; everything else is irrelevant.
 */
function makeTheme(overrides: Record<string, unknown> = {}) {
  return {
    text: {
      base: "text-base",
      muted: "text-muted",
      faint: "text-faint",
      feedback: {
        error: { base: "error-base" },
        warning: { base: "warning-base" },
        success: { base: "success-base" },
        info: { base: "info-base" },
      },
    },
    border: { base: "border-base" },
    hue: { accent: { [HUE_STEP]: "accent-500" } },
    categorical: [
      { [HUE_STEP]: "categorical-0" },
      { [HUE_STEP]: "categorical-1" },
    ],
    ...overrides,
  } as any;
}

describe("createV2PanelTheme", () => {
  it("maps semantic V2 tokens to the panel theme", () => {
    const theme = createV2PanelTheme(makeTheme());

    assert.equal(theme.text, "text-base");
    assert.equal(theme.muted, "text-muted");
    assert.equal(theme.faint, "text-faint");
    assert.equal(theme.border, "border-base");
    assert.equal(theme.accent, "accent-500");
    assert.equal(theme.error, "error-base");
    assert.equal(theme.warning, "warning-base");
    assert.equal(theme.success, "success-base");
    assert.equal(theme.info, "info-base");
  });

  it("maps categorical indexes and wraps around", () => {
    const theme = createV2PanelTheme(makeTheme());

    assert.equal(theme.categorical(0), "categorical-0");
    assert.equal(theme.categorical(1), "categorical-1");
    assert.equal(theme.categorical(2), "categorical-0");
    assert.equal(theme.categorical(-1), "categorical-1");
  });

  it("falls back to base text when the categorical palette is empty", () => {
    const theme = createV2PanelTheme(makeTheme({ categorical: [] }));

    assert.equal(theme.categorical(3), "text-base");
  });

  it("falls back to base text when the accent step is missing", () => {
    const theme = createV2PanelTheme(makeTheme({ hue: { accent: {} } }));

    assert.equal(theme.accent, "text-base");
  });

  it("implements the PanelTheme contract", () => {
    const theme: PanelTheme = createV2PanelTheme(makeTheme());
    assert.equal(typeof theme.categorical, "function");
  });
});
