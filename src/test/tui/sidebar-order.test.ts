import { describe, it } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";

// ---------------------------------------------------------------------------
// SIDEBAR_ORDER — named constant exported by the TUI entry
// (`src/tui/agent-monitor-tui.tsx`) that controls the slot `order` used when
// registering the agent-monitor panel in OpenCode's `sidebar_content` slot.
//
// OpenCode sorts registered slots by `order` ascending, so a low positive
// integer (<= 10) reliably places the agent-monitor panel at the top of the
// sidebar, ahead of plugins that typically register with order values in the
// hundreds.
//
// Why static analysis instead of a runtime import:
//   The TUI entry transitively imports `@opentui/solid` (via the
//   fullscreen-stats-dialog component), which in turn pulls in
//   `@opentui/core`. That package uses top-level await in its ESM build,
//   which `tsx` (esbuild) refuses to transform under the CJS output format
//   used by the test runner — so a `node --import tsx` import of the TUI
//   entry fails for environmental reasons unrelated to `SIDEBAR_ORDER`
//   itself. To get a meaningful RED (constant missing) → GREEN (constant
//   present) signal we therefore read the source file directly and assert
//   on its structure. This still satisfies the spec's "pure unit test on
//   the exported constant" acceptance criterion: the constant must be
//   declared as a numeric literal in the file and used in the
//   `api.slots.register` call — exactly the contract that the implementer
//   must satisfy.
// ---------------------------------------------------------------------------

const TUI_SOURCE_PATH = path.join(
  __dirname,
  "..",
  "..",
  "tui",
  "agent-monitor-tui.tsx",
);

function readTuiSource(): string {
  return fs.readFileSync(TUI_SOURCE_PATH, "utf8");
}

describe("SIDEBAR_ORDER (TUI sidebar slot order constant)", () => {
  it("is_a_number: SIDEBAR_ORDER is exported and assigned a numeric literal in src/tui/agent-monitor-tui.tsx", () => {
    const src = readTuiSource();

    // The constant must be exported and assigned a numeric literal.
    // Matches e.g. `export const SIDEBAR_ORDER = 5;` or
    // `export const SIDEBAR_ORDER: number = 5;`.
    const declMatch = src.match(
      /\bexport\s+const\s+SIDEBAR_ORDER\s*(?::\s*\w+\s*)?=\s*(-?\d+)\s*;/,
    );
    assert.ok(
      declMatch !== null,
      "src/tui/agent-monitor-tui.tsx must contain `export const SIDEBAR_ORDER = <number>;`",
    );

    const value = Number(declMatch![1]);
    assert.ok(
      !Number.isNaN(value),
      "SIDEBAR_ORDER value must be a valid number (got " + declMatch![1] + ")",
    );
  });

  it("is_a_positive_integer: SIDEBAR_ORDER is a positive integer", () => {
    const src = readTuiSource();
    const declMatch = src.match(
      /\bexport\s+const\s+SIDEBAR_ORDER\s*(?::\s*\w+\s*)?=\s*(-?\d+)\s*;/,
    );
    assert.ok(
      declMatch !== null,
      "SIDEBAR_ORDER must be declared as `export const SIDEBAR_ORDER = <number>;`",
    );

    const value = Number(declMatch![1]);
    assert.ok(
      Number.isInteger(value),
      "SIDEBAR_ORDER must be an integer (got " + value + ")",
    );
    assert.ok(
      value > 0,
      "SIDEBAR_ORDER must be greater than 0 (got " + value + ")",
    );
  });

  it("is_at_most_10: SIDEBAR_ORDER is a low value (<= 10) so the panel renders first in the sidebar", () => {
    const src = readTuiSource();
    const declMatch = src.match(
      /\bexport\s+const\s+SIDEBAR_ORDER\s*(?::\s*\w+\s*)?=\s*(-?\d+)\s*;/,
    );
    assert.ok(
      declMatch !== null,
      "SIDEBAR_ORDER must be declared as `export const SIDEBAR_ORDER = <number>;`",
    );

    const value = Number(declMatch![1]);
    assert.ok(
      value <= 10,
      "SIDEBAR_ORDER must be <= 10 to claim the first sidebar slot " +
        "(got " +
        value +
        ")",
    );
  });

  it("agent_monitor_tui_uses_constant_in_register_call: api.slots.register references SIDEBAR_ORDER (no duplicate hardcoded numeric order)", () => {
    const src = readTuiSource();

    // Locate the api.slots.register({ ... }) call and inspect its body.
    // The call shape is:
    //   api.slots.register({
    //     order: SIDEBAR_ORDER,
    //     slots: { sidebar_content: ... },
    //   } satisfies TuiSlotPlugin);
    //
    // We only need the part between the outer `{` and its matching `}`.
    // To keep the regex tractable we match up to the closing `} satisfies`
    // pattern that the file uses, falling back to the first balanced
    // top-level `}` after `api.slots.register(`.
    const callStart = src.search(/api\.slots\.register\s*\(/);
    assert.ok(
      callStart !== -1,
      "api.slots.register call must exist in src/tui/agent-monitor-tui.tsx",
    );

    // Extract the substring starting at the opening `(` of register(...).
    const fromCall = src.slice(callStart);
    // Find the opening `{` of the register argument.
    const openBraceIdx = fromCall.indexOf("{");
    assert.ok(
      openBraceIdx !== -1,
      "api.slots.register call must take an object literal argument",
    );

    // Walk forward tracking brace depth to find the matching close brace.
    let depth = 0;
    let closeBraceIdx = -1;
    for (let i = openBraceIdx; i < fromCall.length; i++) {
      const ch = fromCall[i];
      if (ch === "{") depth++;
      else if (ch === "}") {
        depth--;
        if (depth === 0) {
          closeBraceIdx = i;
          break;
        }
      }
    }
    assert.ok(
      closeBraceIdx !== -1,
      "could not find the closing brace of the api.slots.register call",
    );

    const callBody = fromCall.slice(openBraceIdx, closeBraceIdx + 1);

    // 1. The `order` field must reference the SIDEBAR_ORDER constant, not
    //    a numeric literal.
    assert.ok(
      /\border\s*:\s*SIDEBAR_ORDER\b/.test(callBody),
      "api.slots.register(...) must set `order: SIDEBAR_ORDER` (constant reference, not a numeric literal)",
    );

    // 2. There must be no numeric literal in the `order:` position. This
    //    guards against a regression where the constant is declared but
    //    the call site still has a hardcoded duplicate value.
    assert.ok(
      !/\border\s*:\s*-?\d+(?:\.\d+)?\b/.test(callBody),
      "api.slots.register(...) must not use a numeric literal for `order`; use SIDEBAR_ORDER instead",
    );

    // 3. The `sidebar_content` slot must still be present (regression
    //    guard — the spec says the slot registration is otherwise
    //    unchanged).
    assert.ok(
      /\bsidebar_content\s*:/.test(callBody),
      "api.slots.register(...) must still register the `sidebar_content` slot",
    );
  });
});
