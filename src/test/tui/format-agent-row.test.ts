import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  formatAgentRow,
  formatAgentRows,
} from "../../tui/formatters/format-agent-row";
import type { Aggregate } from "../../shared/metrics.types";

// ---------------------------------------------------------------------------
// Test fixture builder
// ---------------------------------------------------------------------------
//
// A small helper that produces an Aggregate with the bits we care about
// defaulted to zero, so each test only has to specify the fields it needs.
// Keeping the builder in the test file (rather than the production helper)
// avoids creating a dependency on `MetricsAggregatorHelper` for what is
// otherwise a pure formatting concern.

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

// ---------------------------------------------------------------------------
// formatAgentRow — single agent formatting
// ---------------------------------------------------------------------------

describe("formatAgentRow", () => {
  it("includes_agent_name_cost_tokens_and_calls_in_output", () => {
    // The spec documents the canonical example row:
    //   coder  $0.0234  ctx: 12,345  in: 1,000  out: 500  calls: 3  err: 0
    // We assert on each piece of information that must appear, rather than
    // locking the test to a specific whitespace layout.
    const row = formatAgentRow(
      "coder",
      makeAggregate({
        llmCalls: 3,
        llmErrors: 0,
        tokens: { input: 1000, output: 500, reasoning: 11145, cacheRead: 200 },
        cost: 0.0234,
      }),
    );

    assert.equal(typeof row, "string", "formatAgentRow must return a string");
    assert.ok(row.includes("coder"), "row must contain the agent name");
    assert.ok(
      row.includes("$0.0234"),
      "cost must be formatted as $X.XXXX (4 decimal places); got: " + row,
    );
    assert.ok(
      row.includes("12,345"),
      "context tokens must appear with locale separators; got: " + row,
    );
    assert.ok(
      row.includes("1,000"),
      "input tokens must appear with locale separators; got: " + row,
    );
    assert.ok(row.includes("500"), "output tokens must appear; got: " + row);
    assert.ok(row.includes("3"), "call count must appear; got: " + row);
    assert.ok(row.includes("0"), "error count must appear; got: " + row);
  });

  it("computes_context_tokens_as_input_plus_cacheRead_plus_reasoning", () => {
    // ctx = input + cacheRead + reasoning (per spec, "Technical Notes").
    // Output tokens are NOT part of the context figure.
    const row = formatAgentRow(
      "reviewer",
      makeAggregate({
        tokens: { input: 100, output: 9999, reasoning: 50, cacheRead: 25 },
        cost: 0,
      }),
    );

    // 100 + 25 + 50 = 175
    assert.ok(
      row.includes("175"),
      "ctx must be input + cacheRead + reasoning (= 175); got: " + row,
    );
    // 9999 (output) must NOT bleed into the ctx figure
    assert.ok(
      !row.includes("9,999"),
      "output tokens must not be added to ctx; got: " + row,
    );
  });

  it("formats_small_token_counts_without_separators", () => {
    // Token counts below 1000 should appear as plain integers (no commas).
    // toLocaleString('en-US') returns the bare integer for values < 1000.
    const row = formatAgentRow(
      "scout",
      makeAggregate({
        tokens: { input: 42, output: 7, reasoning: 3, cacheRead: 1 },
        cost: 0.0001,
      }),
    );

    assert.ok(row.includes("42"), "small input count must appear; got: " + row);
    assert.ok(row.includes("7"), "small output count must appear; got: " + row);
    // 42 + 1 + 3 = 46
    assert.ok(
      row.includes("46"),
      "small ctx count must appear un-grouped; got: " + row,
    );
  });
});

// ---------------------------------------------------------------------------
// formatAgentRows — multi-agent sorting and the zero-agent case
// ---------------------------------------------------------------------------

describe("formatAgentRows", () => {
  it("zero_agents_returns_empty_array: returns [] when byAgent is empty", () => {
    const rows = formatAgentRows({});
    assert.ok(Array.isArray(rows), "result must be an array");
    assert.equal(rows.length, 0, "empty input must produce an empty array");
  });

  it("single_agent_returns_one_formatted_row: returns exactly one string", () => {
    const rows = formatAgentRows({
      coder: makeAggregate({
        llmCalls: 1,
        llmErrors: 0,
        tokens: { input: 10, output: 5, reasoning: 0, cacheRead: 0 },
        cost: 0.001,
      }),
    });

    assert.equal(rows.length, 1, "one agent must produce one row");
    assert.equal(typeof rows[0], "string", "each row must be a string");
    assert.ok(rows[0].includes("coder"), "row must mention the agent name");
  });

  it("n_agents_sorted_by_cost_descending: highest cost comes first", () => {
    const rows = formatAgentRows({
      alpha: makeAggregate({ cost: 0.01, llmCalls: 1 }),
      bravo: makeAggregate({ cost: 0.1, llmCalls: 1 }),
      charlie: makeAggregate({ cost: 0.05, llmCalls: 1 }),
      delta: makeAggregate({ cost: 0.1, llmCalls: 1 }), // tie with bravo
    });

    assert.equal(rows.length, 4, "all four agents must be present");

    // The first two rows must be the two agents that share the top cost
    // (0.10). Order between equal-cost agents is implementation-defined,
    // but the high-cost ones must come before the lower-cost ones.
    const firstTwoHaveTopCost =
      rows[0].includes("$0.1000") && rows[1].includes("$0.1000");
    assert.ok(
      firstTwoHaveTopCost,
      "top two rows must be the $0.1000 agents; got: " + JSON.stringify(rows),
    );

    // The last two rows must be the lower-cost agents.
    assert.ok(
      rows[2].includes("$0.0500"),
      "third row must be the $0.0500 agent; got: " + rows[2],
    );
    assert.ok(
      rows[3].includes("$0.0100"),
      "fourth row must be the $0.0100 agent; got: " + rows[3],
    );

    // And the first row in particular must NOT be the cheapest agent.
    assert.ok(
      !rows[0].includes("$0.0100"),
      "cheapest agent must not be first; got: " + rows[0],
    );
  });

  it("n_agents_sorted_by_cost_descending: works for two agents in any input order", () => {
    // Even when the cheaper agent is listed first in the input, the output
    // must place the more expensive agent first.
    const rows = formatAgentRows({
      cheap: makeAggregate({ cost: 0.001, llmCalls: 1 }),
      pricey: makeAggregate({ cost: 0.999, llmCalls: 1 }),
    });

    assert.equal(rows.length, 2);
    assert.ok(
      rows[0].includes("pricey") && rows[0].includes("$0.9990"),
      "first row must be the more expensive agent; got: " + rows[0],
    );
    assert.ok(
      rows[1].includes("cheap") && rows[1].includes("$0.0010"),
      "second row must be the cheaper agent; got: " + rows[1],
    );
  });

  it("large_tokens_formatted_with_locale_separators: thousand-grouped output", () => {
    // Per the spec: tokens >= 1000 are formatted with locale separators.
    // Use unambiguous values that cannot collide with other fields in the row.
    const row = formatAgentRows({
      big: makeAggregate({
        llmCalls: 2,
        llmErrors: 1,
        tokens: { input: 1234, output: 5678, reasoning: 9000, cacheRead: 100 },
        cost: 1.2345,
      }),
    })[0];

    // input = 1,234
    assert.ok(
      row.includes("1,234"),
      "input of 1234 must render as '1,234'; got: " + row,
    );
    // output = 5,678
    assert.ok(
      row.includes("5,678"),
      "output of 5678 must render as '5,678'; got: " + row,
    );
    // ctx = input + cacheRead + reasoning = 1234 + 100 + 9000 = 10,334
    assert.ok(
      row.includes("10,334"),
      "ctx of 10334 must render as '10,334'; got: " + row,
    );
    // The bare (un-grouped) number must not appear in the row, which would
    // indicate the formatter skipped the thousands separator.
    assert.ok(
      !row.includes("1234 "),
      "input must not appear in un-grouped form; got: " + row,
    );
  });

  it("large_tokens_formatted_with_locale_separators: handles values at and above 1,000,000", () => {
    // Sanity check that toLocaleString groups correctly for very large
    // numbers (millions and above).
    const row = formatAgentRows({
      whale: makeAggregate({
        tokens: { input: 1_234_567, output: 0, reasoning: 0, cacheRead: 0 },
        cost: 0,
      }),
    })[0];

    assert.ok(
      row.includes("1,234,567"),
      "six-digit input must render as '1,234,567'; got: " + row,
    );
  });
});
