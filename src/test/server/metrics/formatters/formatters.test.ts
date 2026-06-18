import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type {
  Aggregate,
  ErrorEntry,
  MetricsSnapshot,
  ToolStats,
} from "../../../../shared/metrics.types";
import { formatJson } from "../../../../shared/formatters/json";
import { formatMarkdown } from "../../../../shared/formatters/markdown";
import { formatCsv } from "../../../../shared/formatters/csv";

/**
 * Build a fully-populated-but-empty `MetricsSnapshot` that satisfies the
 * shape contract. Tests pass an `overrides` object to fill in only the
 * fields they care about — every other field defaults to a sensible zero.
 *
 * Why a factory and not a shared fixture: the aggregator mutates
 * state across tests, and formatters take a fresh snapshot each
 * call. A factory is the smallest possible unit of setup and makes
 * each test self-documenting (you see the input shape inline).
 */
function makeMockSnapshot(
  overrides?: Partial<MetricsSnapshot>,
): MetricsSnapshot {
  const base: MetricsSnapshot = {
    totals: {
      llmCalls: 0,
      llmErrors: 0,
      toolCalls: 0,
      toolErrors: 0,
      tokens: { input: 0, output: 0, reasoning: 0, cacheRead: 0 },
      cost: 0,
      workDurationMs: 0,
      sessionsCreated: 0,
      sessionErrors: 0,
    },
    bySession: {},
    byAgent: {},
    byModel: {},
    byAgentModel: {},
    byTool: {},
    errors: [],
    window: { firstSeenAt: 0, lastSeenAt: 0 },
    lastActiveAgent: null,
  };
  if (!overrides) return base;

  // Shallow merge with one extra level for `totals` so callers can
  // override individual total fields without re-typing the whole shape.
  return {
    ...base,
    ...overrides,
    totals: { ...base.totals, ...(overrides.totals ?? {}) },
  };
}

function makeAggregate(overrides?: Partial<Aggregate>): Aggregate {
  return {
    llmCalls: 0,
    llmErrors: 0,
    toolCalls: 0,
    toolErrors: 0,
    tokens: { input: 0, output: 0, reasoning: 0, cacheRead: 0 },
    cost: 0,
    workDurationMs: 0,
    ...overrides,
  };
}

function makeToolStats(overrides?: Partial<ToolStats>): ToolStats {
  return { calls: 0, errors: 0, durationMs: 0, ...overrides };
}

function makeError(overrides?: Partial<ErrorEntry>): ErrorEntry {
  return {
    sessionID: "sess-1",
    type: "llm_error",
    message: "boom",
    timestamp: 1_700_000_000_000,
    ...overrides,
  };
}

describe("formatJson", () => {
  it("returns valid JSON that round-trips through JSON.parse", () => {
    const snap = makeMockSnapshot();
    const out = formatJson(snap);
    const parsed: unknown = JSON.parse(out);
    assert.equal(typeof parsed, "object");
    assert.notEqual(parsed, null);
  });

  it("includes byTool and errors sections in the output", () => {
    const snap = makeMockSnapshot({
      byTool: {
        bash: makeToolStats({ calls: 3, errors: 1, durationMs: 250 }),
      },
      errors: [makeError({ type: "tool_error", sessionID: "sess-A" })],
    });

    const out = formatJson(snap);
    const parsed = JSON.parse(out) as MetricsSnapshot;

    assert.ok("byTool" in parsed, "JSON output must contain byTool");
    assert.ok("errors" in parsed, "JSON output must contain errors");
    assert.equal(parsed.byTool["bash"]!.calls, 3);
    assert.equal(parsed.errors.length, 1);
    assert.equal(parsed.errors[0]!.type, "tool_error");
  });

  it("replaces non-finite numbers (Infinity/NaN) with 0", () => {
    const snap = makeMockSnapshot({
      totals: {
        llmCalls: 0,
        llmErrors: 0,
        toolCalls: 0,
        toolErrors: 0,
        tokens: { input: 0, output: 0, reasoning: 0, cacheRead: 0 },
        cost: Number.POSITIVE_INFINITY,
        workDurationMs: 0,
        sessionsCreated: 0,
        sessionErrors: 0,
      },
      byAgent: {
        coder: makeAggregate({ cost: Number.NaN }),
      },
    });

    const out = formatJson(snap);

    // `JSON.stringify(Infinity)` produces `null`; the replacer must
    // convert it to `0` to keep the output valid and meaningful.
    assert.ok(
      out.includes('"cost": 0'),
      "expected Infinity to be replaced with 0 in totals.cost",
    );
    assert.ok(
      out.includes('"cost": 0'),
      "expected NaN to be replaced with 0 in byAgent.*.cost",
    );
    // And the output must remain valid JSON
    const parsed = JSON.parse(out) as MetricsSnapshot;
    assert.equal(parsed.totals.cost, 0);
    assert.equal(parsed.byAgent["coder"]!.cost, 0);
  });
});

describe("formatMarkdown", () => {
  it("includes the summary section header", () => {
    const out = formatMarkdown(makeMockSnapshot());
    assert.ok(out.includes("# Agent Monitor Metrics"));
    assert.ok(out.includes("## Summary"));
  });

  it("includes 'By Agent' section when byAgent has entries", () => {
    const snap = makeMockSnapshot({
      byAgent: {
        coder: makeAggregate({ llmCalls: 5, llmErrors: 1, cost: 0.0123 }),
      },
    });
    const out = formatMarkdown(snap);
    assert.ok(out.includes("## By Agent"));
    assert.ok(out.includes("| coder |"));
  });

  it("includes 'By Tool' section when byTool has entries", () => {
    const snap = makeMockSnapshot({
      byTool: {
        bash: makeToolStats({ calls: 10, errors: 2, durationMs: 500 }),
      },
    });
    const out = formatMarkdown(snap);
    assert.ok(out.includes("## By Tool"));
    assert.ok(out.includes("| bash |"));
  });

  it("includes '## Errors' section when errors[] has entries", () => {
    const snap = makeMockSnapshot({
      errors: [
        makeError({
          sessionID: "sess-X",
          type: "llm_error",
          message: "rate limit",
        }),
        makeError({
          sessionID: "sess-Y",
          type: "tool_error",
          message: "exit 1",
        }),
      ],
    });
    const out = formatMarkdown(snap);
    assert.ok(out.includes("## Errors"));
    assert.ok(out.includes("| sess-X |"));
    assert.ok(out.includes("| sess-Y |"));
  });

  it("omits optional sections when snapshot is empty", () => {
    const out = formatMarkdown(makeMockSnapshot());
    // summary is always there
    assert.ok(out.includes("## Summary"));
    // optional sections must be absent
    assert.ok(!out.includes("## By Agent"));
    assert.ok(!out.includes("## By Tool"));
    assert.ok(!out.includes("## Errors"));
  });
});

describe("formatCsv", () => {
  it("returns a CSV whose first line is the header", () => {
    const out = formatCsv(makeMockSnapshot());
    const firstLine = out.split("\n")[0];
    assert.equal(firstLine, "section,key,metric,value");
  });

  it("includes the totals section", () => {
    const out = formatCsv(makeMockSnapshot());
    assert.ok(out.includes("totals,,llmCalls,"));
    assert.ok(out.includes("totals,,cost,"));
    assert.ok(out.includes("totals,,sessionsCreated,"));
    assert.ok(out.includes("totals,,sessionErrors,"));
  });

  it("emits at least the header and zeroed totals for an empty snapshot", () => {
    const out = formatCsv(makeMockSnapshot());
    const lines = out.split("\n");
    assert.equal(lines[0], "section,key,metric,value");
    // 7 totals rows are always emitted (llmCalls, llmErrors, toolCalls,
    // toolErrors, cost, sessionsCreated, sessionErrors)
    const totalsLines = lines.filter((l) => l.startsWith("totals,"));
    assert.equal(totalsLines.length, 7);
    // and they are zeroed
    assert.ok(totalsLines.every((l) => l.endsWith(",0")));
  });

  it("includes error entries with the 'error,' prefix", () => {
    const snap = makeMockSnapshot({
      errors: [
        makeError({
          sessionID: "sess-1",
          type: "llm_error",
          message: "boom",
          timestamp: 1_700_000_000_000,
        }),
        makeError({
          sessionID: "sess-2",
          type: "tool_error",
          message: "exit 1",
          timestamp: 1_700_000_000_001,
        }),
      ],
    });
    const out = formatCsv(snap);
    const errorLines = out.split("\n").filter((l) => l.startsWith("error,"));
    assert.equal(errorLines.length, 2);
    assert.ok(errorLines[0]!.includes("sess-1"));
    assert.ok(errorLines[0]!.includes("llm_error"));
    assert.ok(errorLines[0]!.includes("boom"));
    assert.ok(errorLines[0]!.endsWith("1700000000000"));
    assert.ok(errorLines[1]!.includes("sess-2"));
    assert.ok(errorLines[1]!.includes("tool_error"));
  });
});
