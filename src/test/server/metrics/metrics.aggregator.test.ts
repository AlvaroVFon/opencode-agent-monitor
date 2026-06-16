import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { EventType, PartStatus, PartType, Role } from "../../../server/enums";
import { MetricsAggregator } from "../../../server/metrics/metrics.aggregator";
import { MetricsAggregatorHelper } from "../../../server/helpers/metrics-aggregator.helper";

const makeLlmCallEvent = (overrides: Record<string, unknown> = {}) => ({
  type: EventType.MESSAGE_UPDATED,
  properties: {
    info: {
      role: Role.ASSISTANT,
      sessionID: "sess-1",
      finish: "stop",
      tokens: { input: 10, output: 20, reasoning: 1, cache: { read: 5 } },
      providerID: "openai",
      modelID: "gpt-4",
      cost: 0.002,
      time: { created: 1000, completed: 1050 },
      ...overrides,
    },
  },
});

const makeLlmErrorEvent = (overrides: Record<string, unknown> = {}) => ({
  type: EventType.MESSAGE_UPDATED,
  properties: {
    info: {
      role: Role.ASSISTANT,
      sessionID: "sess-1",
      providerID: "openai",
      modelID: "gpt-4",
      error: { name: "UnknownError", data: { message: "boom" } },
      ...overrides,
    },
  },
});

const makeToolCallEvent = (
  status: PartStatus,
  overrides: Record<string, unknown> = {},
) => ({
  type: EventType.MESSAGE_PART_UPDATED,
  properties: {
    part: {
      type: PartType.TOOL,
      sessionID: "sess-1",
      callID: "call-1",
      tool: "bash",
      state: {
        status,
        time: { start: 1000, end: 1100 },
        ...(status === PartStatus.ERROR ? { error: "boom" } : {}),
      },
      ...overrides,
    },
  },
});

const makeSessionCreatedEvent = (id: string) => ({
  type: EventType.SESSION_CREATED,
  properties: { info: { id, parentID: null } },
});

describe("MetricsAggregator", () => {
  it("ingests llm_call and updates totals, bySession, byAgent, byModel", () => {
    const currentAgent = new Map([["sess-1", "coder"]]);
    const aggregator = new MetricsAggregator(
      currentAgent,
      new MetricsAggregatorHelper(),
    );

    aggregator.ingest(makeLlmCallEvent());

    const snap = aggregator.snapshot();
    assert.equal(snap.totals.llmCalls, 1);
    assert.equal(snap.totals.tokens.input, 10);
    assert.equal(snap.totals.tokens.output, 20);
    assert.equal(snap.totals.tokens.reasoning, 1);
    assert.equal(snap.totals.tokens.cacheRead, 5);
    assert.equal(snap.totals.cost, 0.002);
    assert.equal(snap.bySession["sess-1"].llmCalls, 1);
    assert.equal(snap.byAgent["coder"].llmCalls, 1);
    assert.equal(snap.byModel["openai/gpt-4"].llmCalls, 1);
    assert.equal(snap.bySession["sess-1"].cost, 0.002);

    // byAgentModel — the per-agent+model bucket
    assert.ok(
      "coder" in snap.byAgentModel,
      "byAgentModel must contain the event's agent name",
    );
    assert.ok(
      "openai/gpt-4" in snap.byAgentModel["coder"]!,
      "byAgentModel[coder] must contain the event's model",
    );
    assert.equal(
      snap.byAgentModel["coder"]!["openai/gpt-4"]!.llmCalls,
      1,
      "byAgentModel[coder][openai/gpt-4].llmCalls",
    );
    assert.equal(
      snap.byAgentModel["coder"]!["openai/gpt-4"]!.cost,
      0.002,
      "byAgentModel[coder][openai/gpt-4].cost",
    );
  });

  it("splits aggregates across distinct agents and models", () => {
    const currentAgent = new Map([
      ["sess-1", "coder"],
      ["sess-2", "reviewer"],
    ]);
    const aggregator = new MetricsAggregator(
      currentAgent,
      new MetricsAggregatorHelper(),
    );

    aggregator.ingest(makeLlmCallEvent({ sessionID: "sess-1" }));
    aggregator.ingest(
      makeLlmCallEvent({
        sessionID: "sess-2",
        providerID: "anthropic",
        modelID: "claude-3",
        cost: 0.003,
        tokens: { input: 5, output: 8, reasoning: 0, cache: { read: 0 } },
      }),
    );

    const snap = aggregator.snapshot();
    assert.equal(snap.totals.llmCalls, 2);
    assert.equal(snap.totals.cost, 0.005);
    assert.equal(Object.keys(snap.byAgent).length, 2);
    assert.equal(snap.byAgent["coder"].llmCalls, 1);
    assert.equal(snap.byAgent["reviewer"].llmCalls, 1);
    assert.equal(Object.keys(snap.byModel).length, 2);
    assert.equal(snap.byModel["openai/gpt-4"].cost, 0.002);
    assert.equal(snap.byModel["anthropic/claude-3"].cost, 0.003);

    // byAgentModel — each agent must keep its model segregated
    assert.equal(Object.keys(snap.byAgentModel).length, 2);
    assert.equal(snap.byAgentModel["coder"]!["openai/gpt-4"]!.cost, 0.002);
    assert.equal(
      snap.byAgentModel["reviewer"]!["anthropic/claude-3"]!.cost,
      0.003,
    );
    assert.equal(
      Object.keys(snap.byAgentModel["coder"]!).length,
      1,
      "coder must have exactly one model bucket",
    );
    assert.equal(
      Object.keys(snap.byAgentModel["reviewer"]!).length,
      1,
      "reviewer must have exactly one model bucket",
    );
  });

  it("byAgentModel separates multiple models for the same agent", () => {
    const currentAgent = new Map([["sess-1", "coder"]]);
    const aggregator = new MetricsAggregator(
      currentAgent,
      new MetricsAggregatorHelper(),
    );

    aggregator.ingest(
      makeLlmCallEvent({
        modelID: "gpt-4",
        cost: 0.001,
        tokens: { input: 10, output: 5, reasoning: 0, cache: { read: 0 } },
      }),
    );
    aggregator.ingest(
      makeLlmCallEvent({
        modelID: "gpt-4o-mini",
        cost: 0.0005,
        tokens: { input: 20, output: 10, reasoning: 0, cache: { read: 0 } },
      }),
    );
    aggregator.ingest(
      makeLlmCallEvent({
        modelID: "gpt-4",
        cost: 0.002,
        tokens: { input: 30, output: 15, reasoning: 0, cache: { read: 0 } },
      }),
    );

    const snap = aggregator.snapshot();
    const coder = snap.byAgentModel["coder"]!;
    assert.equal(
      Object.keys(coder).length,
      2,
      "coder must have two model buckets",
    );
    assert.equal(coder["openai/gpt-4"]!.llmCalls, 2);
    assert.equal(coder["openai/gpt-4"]!.cost, 0.003);
    assert.equal(coder["openai/gpt-4o-mini"]!.llmCalls, 1);
    assert.equal(coder["openai/gpt-4o-mini"]!.cost, 0.0005);
  });

  it("ingests llm_error without touching tokens or cost", () => {
    const currentAgent = new Map([["sess-1", "coder"]]);
    const aggregator = new MetricsAggregator(
      currentAgent,
      new MetricsAggregatorHelper(),
    );

    aggregator.ingest(makeLlmErrorEvent());

    const snap = aggregator.snapshot();
    assert.equal(snap.totals.llmErrors, 1);
    assert.equal(snap.totals.llmCalls, 0);
    assert.equal(snap.totals.cost, 0);
    assert.equal(snap.totals.tokens.input, 0);
    assert.equal(snap.byAgent["coder"].llmErrors, 1);
  });

  it("ingests tool_call completed", () => {
    const currentAgent = new Map([["sess-1", "coder"]]);
    const aggregator = new MetricsAggregator(
      currentAgent,
      new MetricsAggregatorHelper(),
    );

    aggregator.ingest(makeToolCallEvent(PartStatus.COMPLETED));

    const snap = aggregator.snapshot();
    assert.equal(snap.totals.toolCalls, 1);
    assert.equal(snap.totals.toolErrors, 0);
    assert.equal(snap.byAgent["coder"].toolCalls, 1);
  });

  it("ingests tool_call error", () => {
    const currentAgent = new Map([["sess-1", "coder"]]);
    const aggregator = new MetricsAggregator(
      currentAgent,
      new MetricsAggregatorHelper(),
    );

    aggregator.ingest(makeToolCallEvent(PartStatus.ERROR));

    const snap = aggregator.snapshot();
    assert.equal(snap.totals.toolCalls, 1);
    assert.equal(snap.totals.toolErrors, 1);
    assert.equal(snap.byAgent["coder"].toolErrors, 1);
  });

  it("ingests session_created and updates firstSeenAt/lastSeenAt window", () => {
    const aggregator = new MetricsAggregator(
      new Map(),
      new MetricsAggregatorHelper(),
    );

    aggregator.ingest(makeSessionCreatedEvent("sess-A"));

    const snap = aggregator.snapshot();
    assert.equal(snap.totals.sessionsCreated, 1);
    assert.ok(snap.window.firstSeenAt > 0);
    assert.ok(snap.window.lastSeenAt >= snap.window.firstSeenAt);
    assert.ok("sess-A" in snap.bySession);
  });

  it("returns zeroed snapshot for fresh aggregator", () => {
    const aggregator = new MetricsAggregator(
      new Map(),
      new MetricsAggregatorHelper(),
    );

    const snap = aggregator.snapshot();
    assert.equal(snap.totals.llmCalls, 0);
    assert.equal(snap.totals.llmErrors, 0);
    assert.equal(snap.totals.toolCalls, 0);
    assert.equal(snap.totals.toolErrors, 0);
    assert.equal(snap.totals.sessionsCreated, 0);
    assert.equal(snap.totals.cost, 0);
    assert.equal(snap.totals.tokens.input, 0);
    assert.equal(snap.totals.tokens.output, 0);
    assert.equal(snap.totals.tokens.reasoning, 0);
    assert.equal(snap.totals.tokens.cacheRead, 0);
    assert.equal(snap.window.firstSeenAt, 0);
    assert.equal(snap.window.lastSeenAt, 0);
    assert.deepEqual(snap.bySession, {});
    assert.deepEqual(snap.byAgent, {});
    assert.deepEqual(snap.byModel, {});
    assert.deepEqual(snap.byAgentModel, {});
  });

  it("reset() clears all state", () => {
    const currentAgent = new Map([["sess-1", "coder"]]);
    const aggregator = new MetricsAggregator(
      currentAgent,
      new MetricsAggregatorHelper(),
    );

    aggregator.ingest(makeLlmCallEvent());
    aggregator.ingest(makeLlmErrorEvent());
    aggregator.ingest(makeToolCallEvent(PartStatus.COMPLETED));
    aggregator.ingest(makeSessionCreatedEvent("sess-1"));

    aggregator.reset();

    const snap = aggregator.snapshot();
    assert.equal(snap.totals.llmCalls, 0);
    assert.equal(snap.totals.llmErrors, 0);
    assert.equal(snap.totals.toolCalls, 0);
    assert.equal(snap.totals.sessionsCreated, 0);
    assert.equal(snap.window.firstSeenAt, 0);
    assert.equal(snap.window.lastSeenAt, 0);
    assert.deepEqual(snap.bySession, {});
  });
});
