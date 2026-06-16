import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { formatTotalsRow } from "../../tui/formatters/format-totals-row";
import type { Aggregate, MetricsSnapshot } from "../../shared/metrics.types";

// ---------------------------------------------------------------------------
// Test fixture builder
// ---------------------------------------------------------------------------
//
// Mirrors the convention from the sibling `format-agent-row.test.ts` and
// `format-fullscreen-table.test.ts` files: a small builder that produces a
// fully-populated snapshot with the bits we care about defaulted to zero.
//
// The totals shape used by the spec carries `sessionErrors` in addition to
// `sessionsCreated` (the AggregatorStore internally tracks session errors as
// part of the grand totals). The exported `MetricsSnapshot.totals` type
// currently only declares `sessionsCreated`, so we widen the type locally
// in this test file rather than modifying the production interface.

type TotalsWithSessionErrors = Aggregate & {
  sessionsCreated: number;
  sessionErrors: number;
};

function makeAggregate(overrides: Partial<Aggregate> = {}): Aggregate {
  return {
    llmCalls: 0,
    llmErrors: 0,
    toolCalls: 0,
    toolErrors: 0,
    tokens: { input: 0, output: 0, reasoning: 0, cacheRead: 0 },
    cost: 0,
    ...overrides,
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
  totalsOverride: Partial<TotalsWithSessionErrors> = {},
  byAgent: Record<string, Aggregate> = {},
): MetricsSnapshot {
  const totals: TotalsWithSessionErrors = {
    llmCalls: 0,
    llmErrors: 0,
    toolCalls: 0,
    toolErrors: 0,
    tokens: { input: 0, output: 0, reasoning: 0, cacheRead: 0 },
    cost: 0,
    sessionsCreated: 0,
    sessionErrors: 0,
    ...totalsOverride,
    tokens: {
      input: 0,
      output: 0,
      reasoning: 0,
      cacheRead: 0,
      ...(totalsOverride.tokens ?? {}),
    },
  };
  return {
    byAgent,
    bySession: {},
    byModel: {},
    byAgentModel: {},
    window: { firstSeenAt: 0, lastSeenAt: 0 },
    totals,
  };
}

// ---------------------------------------------------------------------------
// formatTotalsRow — empty and small-value baselines
// ---------------------------------------------------------------------------

describe("formatTotalsRow", () => {
  it("empty_snapshot_returns_zero_cost_zero_calls_zero_errors", () => {
    // Acceptance criterion: with an empty snapshot (no events ingested,
    // all counters at 0) the row reads $0.0000 / 0 / 0.
    const row = formatTotalsRow(makeSnapshot());

    assert.deepEqual(
      row,
      { avgCostPerCall: "$0.0000", calls: "0", errors: "0" },
      "empty snapshot must produce { avgCostPerCall: '$0.0000', calls: '0', errors: '0' }",
    );
  });

  it("single_agent_small_values_format_avg_cost_calls_and_error_sum", () => {
    // Acceptance criterion: a snapshot with one agent that has 12 LLM
    // calls, 3 errors, $0.0450 cost must produce avg cost per call
    //   { avgCostPerCall: '$0.0037', calls: '12', errors: '3' }
    // where avgCostPerCall = cost / llmCalls = 0.045 / 12 → toFixed(4) → $0.0037
    // and errors = llmErrors (1) + toolErrors (2) + sessionErrors (0).
    const row = formatTotalsRow(
      makeSnapshot({
        llmCalls: 12,
        llmErrors: 1,
        toolErrors: 2,
        sessionErrors: 0,
        cost: 0.045,
      }),
    );

    assert.deepEqual(
      row,
      { avgCostPerCall: "$0.0037", calls: "12", errors: "3" },
      "single-agent small values must format as documented; got: " +
        JSON.stringify(row),
    );
  });

  // ---------------------------------------------------------------------------
  // Locale-grouped thousands separators
  // ---------------------------------------------------------------------------

  it("thousands_separator_on_calls: 1234 calls renders as '1,234'", () => {
    const row = formatTotalsRow(makeSnapshot({ llmCalls: 1234 }));

    assert.equal(
      row.calls,
      "1,234",
      "calls >= 1000 must be grouped with en-US thousands separator",
    );
    assert.match(
      row.calls,
      /^\d{1,3}(,\d{3})*$/,
      "calls string must be a valid en-US grouped integer",
    );
  });

  it("thousands_separator_on_errors: large error counts are grouped", () => {
    // 1000 + 234 + 1 = 1,235. The spec is explicit that errors are
    // llmErrors + toolErrors + sessionErrors, formatted with thousands
    // separator.
    const row = formatTotalsRow(
      makeSnapshot({
        llmErrors: 1000,
        toolErrors: 234,
        sessionErrors: 1,
      }),
    );

    assert.equal(
      row.errors,
      "1,235",
      "errors >= 1000 must be grouped with en-US thousands separator",
    );
    assert.match(
      row.errors,
      /^\d{1,3}(,\d{3})*$/,
      "errors string must be a valid en-US grouped integer",
    );
  });

  // ---------------------------------------------------------------------------
  // Cost formatting: 4 decimals, $ prefix
  // ---------------------------------------------------------------------------

  it("avg_cost_formatting_4_decimals: integer 1 with 1 call renders as '$1.0000'", () => {
    const row = formatTotalsRow(makeSnapshot({ cost: 1, llmCalls: 1 }));

    assert.equal(
      row.avgCostPerCall,
      "$1.0000",
      "avg cost per call must be padded to 4 decimal places",
    );
  });

  it("avg_cost_formatting_4_decimals: 0.1 with 1 call renders as '$0.1000'", () => {
    const row = formatTotalsRow(makeSnapshot({ cost: 0.1, llmCalls: 1 }));

    assert.equal(
      row.avgCostPerCall,
      "$0.1000",
      "avg cost per call must be padded to 4 decimal places",
    );
  });

  it("avg_cost_formatting_4_decimals: always matches $X.XXXX shape", () => {
    // Even for tiny values where the implementer may choose to round or
    // truncate, the result must still be a $ prefix followed by exactly
    // 4 decimal digits. This deliberately uses a regex assertion so the
    // test does not lock in a particular rounding strategy.
    const row = formatTotalsRow(makeSnapshot({ cost: 0.00005, llmCalls: 1 }));

    assert.match(
      row.avgCostPerCall,
      /^\$\d+\.\d{4}$/,
      "avg cost per call must match $X.XXXX (4 decimals, $ prefix); got: " +
        row.avgCostPerCall,
    );
  });

  // ---------------------------------------------------------------------------
  // Totals are read from snapshot.totals, NOT summed from byAgent
  // ---------------------------------------------------------------------------

  it("uses_totals_not_byAgent: ignores byAgent when totals disagree", () => {
    // The spec explicitly forbids summing from byAgent: doing so would
    // double-count and would be wrong for any future per-session row.
    // Construct a snapshot where byAgent sums to wildly different values
    // than the totals, and assert the output matches totals.
    const snap = makeSnapshot(
      { cost: 0.5, llmCalls: 7, llmErrors: 0, toolErrors: 0 },
      {
        coder: makeAggregate({ cost: 999, llmCalls: 9999, llmErrors: 999 }),
        reviewer: makeAggregate({
          cost: 999,
          llmCalls: 9999,
          llmErrors: 999,
        }),
      },
    );

    const row = formatTotalsRow(snap);

    assert.equal(
      row.avgCostPerCall,
      "$0.0714",
      "avg cost per call must be cost / llmCalls from snapshot.totals; got: " +
        row.avgCostPerCall,
    );
    assert.equal(
      row.calls,
      "7",
      "calls must come from snapshot.totals, not byAgent; got: " + row.calls,
    );
    assert.equal(
      row.errors,
      "0",
      "errors must come from snapshot.totals, not byAgent; got: " + row.errors,
    );
  });

  // ---------------------------------------------------------------------------
  // Output shape
  // ---------------------------------------------------------------------------

  it("shape: returns exactly { avgCostPerCall, calls, errors } with no extras", () => {
    const row = formatTotalsRow(makeSnapshot({ cost: 1.2345, llmCalls: 42 }));

    assert.equal(
      typeof row,
      "object",
      "formatTotalsRow must return an object, not a string",
    );
    assert.notEqual(row, null, "result must not be null");

    const keys = Object.keys(row).sort();
    assert.deepEqual(
      keys,
      ["avgCostPerCall", "calls", "errors"],
      "result must have exactly the keys avgCostPerCall/calls/errors; got: " +
        JSON.stringify(keys),
    );

    assert.equal(
      typeof row.avgCostPerCall,
      "string",
      "avgCostPerCall must be a string",
    );
    assert.equal(typeof row.calls, "string", "calls must be a string");
    assert.equal(typeof row.errors, "string", "errors must be a string");
  });
});
