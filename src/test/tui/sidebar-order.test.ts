import { describe, it } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";

// ---------------------------------------------------------------------------
// TUI slot registration — static source analysis
// ---------------------------------------------------------------------------
//
// OpenCode V2 removed the V1 `api.slots.register({ order, slots })` API. The
// TUI plugin now claims slots through `context.ui.slot({ append, render })`,
// which composes contributions in plugin enable order instead of a numeric
// `order`.
//
// The TUI entry transitively imports `@opentui/solid`, which uses top-level
// await and cannot be imported by the test runner. As with the previous
// sidebar-order test, we assert on the source structure instead.
// ---------------------------------------------------------------------------

const TUI_SOURCE_PATH = path.join(
  import.meta.dirname,
  "..",
  "..",
  "tui",
  "agent-monitor-tui.tsx",
);

function readTuiSource(): string {
  return fs.readFileSync(TUI_SOURCE_PATH, "utf8");
}

describe("TUI slot registration (V2)", () => {
  it("exports the sidebar and panel slot paths", () => {
    const src = readTuiSource();

    assert.match(
      src,
      /export\s+const\s+SIDEBAR_SLOT\s*=\s*"sidebar\.content"\s*;/,
    );
    assert.match(src, /export\s+const\s+PANEL_SLOT\s*=\s*"session\.panel"\s*;/);
  });

  it("claims the sidebar content slot with an append placement", () => {
    const src = readTuiSource();

    const call = src.match(
      /context\.ui\.slot\(\{[\s\S]*?append:\s*SIDEBAR_SLOT[\s\S]*?\}\);/,
    );
    assert.ok(
      call !== null,
      "agent-monitor-tui.tsx must call context.ui.slot({ append: SIDEBAR_SLOT, ... })",
    );
    assert.match(call![0], /render:\s*\(\{\s*sessionID\s*\}\)/);
  });

  it("claims the session panel slot for the fullscreen view", () => {
    const src = readTuiSource();

    const call = src.match(
      /context\.ui\.slot\(\{[\s\S]*?append:\s*PANEL_SLOT[\s\S]*?\}\);/,
    );
    assert.ok(
      call !== null,
      "agent-monitor-tui.tsx must call context.ui.slot({ append: PANEL_SLOT, ... })",
    );
    assert.match(call![0], /panel\.name === PANEL_NAME/);
  });

  it("registers the toggle command with a keymap layer", () => {
    const src = readTuiSource();

    assert.match(src, /context\.keymap\.layer\(/);
    assert.match(src, /id:\s*TOGGLE_COMMAND/);
    assert.match(src, /bind:\s*"ctrl\+a"/);
  });

  it("does not use removed V1 TUI APIs", () => {
    const src = readTuiSource();

    assert.doesNotMatch(src, /api\.slots\.register/);
    assert.doesNotMatch(src, /api\.kv\./);
    assert.doesNotMatch(src, /api\.lifecycle\.onDispose/);
    assert.doesNotMatch(src, /api\.keymap\.registerLayer/);
  });

  it("opens the fullscreen panel through the native panel API", () => {
    const src = readTuiSource();

    assert.match(
      src,
      /context\.ui\.panel\.open\(\s*PANEL_NAME\s*,\s*\{\s*presentation:\s*"fullscreen"\s*\}\s*\)/,
    );
    assert.match(src, /context\.ui\.panel\.close\(\)/);
  });
});
