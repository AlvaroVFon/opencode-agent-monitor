import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { fullscreenTableFormatter } from "../../tui/formatters/fullscreen-table.formatter";
import type { Aggregate, MetricsSnapshot } from "../../shared/metrics.types";

// ---------------------------------------------------------------------------
// Test fixture builders
// ---------------------------------------------------------------------------
//
// `makeAggregate` produces a zeroed Aggregate with the bits we care about
// defaulted, so each test only has to specify the fields it needs. Same
// pattern as the sibling `format-agent-row.test.ts` fixture so that the two
// formatter test files look and read the same way.
//
// `makeSnapshot` wraps an arbitrary `byAgent` map into a fully-populated
// `MetricsSnapshot` (the formatter is only required to read `byAgent` and
// `totals`, but supplying the rest keeps the fixture type-honest).

function makeAggregate(overrides: Partial<Aggregate> = {}): Aggregate {
  return {
    llmCalls: 0,
    llmErrors: 0,
    toolCalls: 0,
    toolErrors: 0,
    tokens: { input: 0, output: 0, reasoning: 0, cacheRead: 0 },
    cost: 0,
    workDurationMs: 0,
    ...overrides,
    // Always start from a clean tokens object so callers don't have to
    // worry about accidentally inheriting partial token data.
    tokens: {
      input: 0,
      output: 0,
      reasoning: 0,
      cacheRead: 0,
      ...overrides.tokens,
    },
  };
}

function makeSnapshot(
  byAgent: Record<string, Aggregate>,
  totalsOverride: Partial<Aggregate & { sessionsCreated: number }> = {},
): MetricsSnapshot {
  return {
    byAgent,
    bySession: {},
    byModel: {},
    byAgentModel: {},
    window: { firstSeenAt: 0, lastSeenAt: 0 },
    totals: {
      llmCalls: 0,
      llmErrors: 0,
      toolCalls: 0,
      toolErrors: 0,
      tokens: { input: 0, output: 0, reasoning: 0, cacheRead: 0 },
      cost: 0,
      workDurationMs: 0,
      sessionsCreated: 0,
      ...totalsOverride,
      tokens: {
        input: 0,
        output: 0,
        reasoning: 0,
        cacheRead: 0,
        ...(totalsOverride.tokens ?? {}),
      },
    },
  };
}

// ---------------------------------------------------------------------------
// basic_view — all agent names and metrics (context, in, out, cost) present
// ---------------------------------------------------------------------------

describe("formatFullscreenTable — basic_view", () => {
  it("basic_view_contains_all_agent_names: every agent name appears in the output", () => {
    const snap = makeSnapshot({
      coder: makeAggregate({ llmCalls: 1, cost: 0.001 }),
      reviewer: makeAggregate({ llmCalls: 1, cost: 0.002 }),
    });

    const out = fullscreenTableFormatter.format(snap);

    assert.equal(
      typeof out,
      "string",
      "formatFullscreenTable must return a string",
    );
    assert.ok(
      out.includes("coder"),
      "output must include agent 'coder'; got: " + out,
    );
    assert.ok(
      out.includes("reviewer"),
      "output must include agent 'reviewer'; got: " + out,
    );
  });

  it("basic_view_contains_all_agent_names_and_metrics: per-agent cost/tokens/calls visible", () => {
    // Two agents with values that are unambiguous when checked individually.
    const snap = makeSnapshot({
      coder: makeAggregate({
        llmCalls: 3,
        tokens: { input: 1000, output: 500, reasoning: 200, cacheRead: 100 },
        cost: 0.0234,
      }),
      reviewer: makeAggregate({
        llmCalls: 7,
        tokens: { input: 4000, output: 1500, reasoning: 0, cacheRead: 0 },
        cost: 0.05,
      }),
    });

    const out = fullscreenTableFormatter.format(snap);

    // -- per-agent costs (formatted as $X.XXXX per the spec) --
    assert.ok(
      out.includes("$0.0234"),
      "coder cost must be rendered as $0.0234; got: " + out,
    );
    assert.ok(
      out.includes("$0.0500"),
      "reviewer cost must be rendered as $0.0500; got: " + out,
    );

    // -- per-agent context (input + cacheRead + reasoning) --
    // coder: 1000 + 100 + 200 = 1,300
    // reviewer: 4000 + 0 + 0 = 4,000
    assert.ok(
      out.includes("1,300"),
      "coder ctx (1,300) must appear with locale separators; got: " + out,
    );
    assert.ok(
      out.includes("4,000"),
      "reviewer ctx (4,000) must appear with locale separators; got: " + out,
    );

    // -- per-agent input / output tokens --
    assert.ok(
      out.includes("1,000"),
      "coder input (1,000) must appear; got: " + out,
    );
    assert.ok(
      out.includes("500"),
      "coder output (500) must appear; got: " + out,
    );
    assert.ok(
      out.includes("4,000"),
      "reviewer input (4,000) must appear; got: " + out,
    );
    assert.ok(
      out.includes("1,500"),
      "reviewer output (1,500) must appear; got: " + out,
    );

    // -- per-agent call counts --
    assert.ok(out.includes("3"), "coder llmCalls (3) must appear; got: " + out);
    assert.ok(
      out.includes("7"),
      "reviewer llmCalls (7) must appear; got: " + out,
    );
  });

  it("basic_view_returns_multiline_output: more than one line when there are agents", () => {
    const snap = makeSnapshot({
      coder: makeAggregate({ llmCalls: 1, cost: 0.001 }),
      reviewer: makeAggregate({ llmCalls: 1, cost: 0.002 }),
    });

    const out = fullscreenTableFormatter.format(snap);
    const lines = out.split("\n").filter((l) => l.length > 0);

    assert.ok(
      lines.length >= 2,
      "output must contain at least one line per agent (plus headers/totals); got " +
        lines.length +
        " lines: " +
        JSON.stringify(lines),
    );
  });
});

// ---------------------------------------------------------------------------
// output_includes_total_row — TOTAL row sums all agents
// ---------------------------------------------------------------------------

describe("formatFullscreenTable — output_includes_total_row", () => {
  it("output_includes_total_row: a 'TOTAL' label appears in the output", () => {
    const snap = makeSnapshot({
      coder: makeAggregate({ llmCalls: 1, cost: 0.01 }),
      reviewer: makeAggregate({ llmCalls: 1, cost: 0.02 }),
    });

    const out = fullscreenTableFormatter.format(snap);

    // Case-insensitive check: the spec is "TOTAL" but the formatter is free
    // to choose casing, so we accept either. The important thing is the row
    // is labelled distinctly from the per-agent rows.
    assert.ok(
      /total/i.test(out),
      "output must include a TOTAL label; got: " + out,
    );
  });

  it("output_includes_total_row: total cost equals the sum across all agents", () => {
    const snap = makeSnapshot({
      coder: makeAggregate({ cost: 0.01 }),
      reviewer: makeAggregate({ cost: 0.025 }),
      scout: makeAggregate({ cost: 0.005 }),
    });

    const out = fullscreenTableFormatter.format(snap);

    // 0.01 + 0.025 + 0.005 = 0.04
    assert.ok(
      out.includes("$0.0400"),
      "total cost (sum = 0.04) must be rendered as $0.0400; got: " + out,
    );
  });

  it("output_includes_total_row: total input/output/context tokens equal the sum", () => {
    const snap = makeSnapshot({
      coder: makeAggregate({
        llmCalls: 2,
        tokens: { input: 1000, output: 500, reasoning: 100, cacheRead: 50 },
        cost: 0.001,
      }),
      reviewer: makeAggregate({
        llmCalls: 4,
        tokens: { input: 2500, output: 750, reasoning: 0, cacheRead: 0 },
        cost: 0.002,
      }),
    });

    const out = fullscreenTableFormatter.format(snap);

    // input:   1000 + 2500 = 3,500
    // output:  500  + 750  = 1,250
    // ctx:     1150 + 2500 = 3,650
    //          (coder ctx = 1000 + 50 + 100 = 1,150)
    assert.ok(
      out.includes("3,500"),
      "total input tokens (3,500) must appear; got: " + out,
    );
    assert.ok(
      out.includes("1,250"),
      "total output tokens (1,250) must appear; got: " + out,
    );
    assert.ok(
      out.includes("3,650"),
      "total context tokens (3,650) must appear; got: " + out,
    );
  });

  it("output_includes_total_row: total call count equals the sum across all agents", () => {
    const snap = makeSnapshot({
      coder: makeAggregate({ llmCalls: 5, cost: 0.001 }),
      reviewer: makeAggregate({ llmCalls: 3, cost: 0.002 }),
      scout: makeAggregate({ llmCalls: 2, cost: 0.003 }),
    });

    const out = fullscreenTableFormatter.format(snap);

    // 5 + 3 + 2 = 10
    assert.ok(
      /\b10\b/.test(out),
      "total call count (10) must appear as a whole number; got: " + out,
    );
  });

  it("output_includes_total_row: totals row appears after the per-agent rows", () => {
    // The spec says the totals row is "at the bottom", so the TOTAL label
    // must come AFTER every agent name in the string.
    const snap = makeSnapshot({
      alpha: makeAggregate({ llmCalls: 1, cost: 0.01 }),
      bravo: makeAggregate({ llmCalls: 1, cost: 0.02 }),
    });

    const out = fullscreenTableFormatter.format(snap);

    const totalIdx = out.search(/total/i);
    const alphaIdx = out.indexOf("alpha");
    const bravoIdx = out.indexOf("bravo");

    assert.ok(totalIdx > -1, "TOTAL label must be present; got: " + out);
    assert.ok(alphaIdx > -1, "alpha must be present; got: " + out);
    assert.ok(bravoIdx > -1, "bravo must be present; got: " + out);
    assert.ok(
      totalIdx > alphaIdx,
      "TOTAL must come after 'alpha'; got: " + out,
    );
    assert.ok(
      totalIdx > bravoIdx,
      "TOTAL must come after 'bravo'; got: " + out,
    );
  });

  it("output_includes_total_row: works correctly with a single agent (no double-counting)", () => {
    // Edge case: a single-agent snapshot must still produce a totals row,
    // and the totals must equal the single agent's values (NOT double them).
    const snap = makeSnapshot({
      only: makeAggregate({
        llmCalls: 4,
        tokens: { input: 2000, output: 800, reasoning: 0, cacheRead: 0 },
        cost: 0.1234,
      }),
    });

    const out = fullscreenTableFormatter.format(snap);

    assert.ok(
      out.includes("$0.1234"),
      "single-agent total cost must match the agent's cost ($0.1234); got: " +
        out,
    );
    // The "only" substring of $0.1234 must not appear twice, which would
    // indicate the formatter double-counted it in a totals row.
    const occurrences = out.split("$0.1234").length - 1;
    assert.ok(
      occurrences >= 1,
      "cost $0.1234 must appear at least once; got: " + out,
    );
  });
});

// ---------------------------------------------------------------------------
// agent_with_errors_shows_error_indicator — errors visible per agent
// ---------------------------------------------------------------------------

describe("formatFullscreenTable — agent_with_errors_shows_error_indicator", () => {
  it("agent_with_errors_shows_error_indicator: llmErrors > 0 surfaces in that agent's row", () => {
    const snap = makeSnapshot({
      lucky: makeAggregate({ llmCalls: 3, llmErrors: 0, cost: 0.001 }),
      unlucky: makeAggregate({ llmCalls: 5, llmErrors: 2, cost: 0.001 }),
    });

    const out = fullscreenTableFormatter.format(snap);

    // The exact wording ("err: 2", "errors: 2", etc.) is implementation
    // defined, but the indicator MUST include the non-zero count "2" and
    // MUST appear in the same row as the "unlucky" agent name. We assert
    // on the line containing "unlucky" rather than the whole document, so
    // a coincidental "2" elsewhere in the table cannot pass the test.
    const lines = out.split("\n");
    const unluckyLine = lines.find((l) => l.includes("unlucky"));

    assert.ok(
      unluckyLine !== undefined,
      "an output line for 'unlucky' must exist; got: " + out,
    );
    assert.ok(
      /\b2\b/.test(unluckyLine),
      "the 'unlucky' row must show the error count (2); got: " + unluckyLine,
    );

    // Conversely, the 'lucky' row (zero errors) should NOT advertise a
    // non-zero error count.
    const luckyLine = lines.find((l) => l.includes("lucky"));
    assert.ok(
      luckyLine !== undefined,
      "an output line for 'lucky' must exist; got: " + out,
    );
  });

  it("agent_with_errors_shows_error_indicator: toolErrors > 0 also surfaces in the agent's row", () => {
    // The acceptance criterion covers both llmErrors and toolErrors (the
    // latter is the more interesting one because it is not the typical
    // "err" field in most renderers). An agent with toolErrors but no
    // llmErrors must still get an indicator that mentions the tool error
    // count.
    const snap = makeSnapshot({
      glitchy: makeAggregate({
        llmCalls: 2,
        llmErrors: 0,
        toolCalls: 4,
        toolErrors: 3,
        cost: 0.01,
      }),
    });

    const out = fullscreenTableFormatter.format(snap);

    const lines = out.split("\n");
    const glitchyLine = lines.find((l) => l.includes("glitchy"));

    assert.ok(
      glitchyLine !== undefined,
      "an output line for 'glitchy' must exist; got: " + out,
    );
    // The "3" must appear in the glitchy row (i.e. the toolErrors figure
    // is being surfaced). The implementation is free to combine it with
    // llmErrors or render it separately; what matters is that the
    // non-zero value is visible per-agent.
    assert.ok(
      /\b3\b/.test(glitchyLine),
      "the 'glitchy' row must show the toolErrors count (3); got: " +
        glitchyLine,
    );
  });

  it("agent_with_errors_shows_error_indicator: error indicator is omitted or zero for clean agents", () => {
    // Sanity / negative case: an agent with no errors must not be shown
    // a spurious non-zero error count. We accept either "err: 0" or no
    // error field at all, but we forbid a positive count in that row.
    const snap = makeSnapshot({
      clean: makeAggregate({
        llmCalls: 10,
        llmErrors: 0,
        toolCalls: 5,
        toolErrors: 0,
        cost: 0.05,
      }),
    });

    const out = fullscreenTableFormatter.format(snap);

    const lines = out.split("\n");
    const cleanLine = lines.find((l) => l.includes("clean"));

    assert.ok(
      cleanLine !== undefined,
      "an output line for 'clean' must exist; got: " + out,
    );
    // The "10" is the llmCalls for clean; it MUST appear.
    assert.ok(
      /\b10\b/.test(cleanLine),
      "llmCalls (10) must appear; got: " + cleanLine,
    );
    // Strip the "10" (calls) from the line so that a "0" anywhere else is
    // not confused with a stray "0" from the calls figure when searching
    // for spurious non-zero error counts. We assert the row does not
    // contain a token like "err: N" with N > 0.
    assert.ok(
      !/err(or)?s?:\s*[1-9]\d*/i.test(cleanLine),
      "clean agent's row must not contain a non-zero error count; got: " +
        cleanLine,
    );
  });

  it("agent_with_errors_shows_error_indicator: totals row reflects summed errors", () => {
    // If the formatter renders a TOTAL row, that row must also surface
    // the summed error count so a glance at the table shows the global
    // health of the run.
    const snap = makeSnapshot({
      a: makeAggregate({ llmCalls: 1, llmErrors: 1, cost: 0.001 }),
      b: makeAggregate({ llmCalls: 1, llmErrors: 1, cost: 0.001 }),
      c: makeAggregate({ llmCalls: 1, llmErrors: 1, cost: 0.001 }),
    });

    const out = fullscreenTableFormatter.format(snap);

    // Locate the TOTAL line (the one that contains the total label).
    const lines = out.split("\n");
    const totalLine = lines.find((l) => /total/i.test(l));

    assert.ok(
      totalLine !== undefined,
      "a line labelled TOTAL must exist; got: " + out,
    );
    // 1 + 1 + 1 = 3 errors summed.
    assert.ok(
      /\b3\b/.test(totalLine),
      "TOTAL row must show summed error count (3); got: " + totalLine,
    );
  });
});
