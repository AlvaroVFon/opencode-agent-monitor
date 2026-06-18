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

const makeSessionErrorEvent = (overrides: Record<string, unknown> = {}) => ({
  type: EventType.SESSION_ERROR,
  properties: {
    sessionID: "sess-1",
    error: { name: "RuntimeError", data: { message: "something broke" } },
    ...overrides,
  },
});

function createTestAggregator(
  currentAgent: Map<string, string>,
  helper = new MetricsAggregatorHelper(),
): MetricsAggregator {
  return new MetricsAggregator(currentAgent, helper);
}

describe("MetricsAggregator", () => {
  it("ingests llm_call and updates totals, bySession, byAgent, byModel", () => {
    const currentAgent = new Map([["sess-1", "coder"]]);
    const aggregator = createTestAggregator(currentAgent);

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
    const aggregator = createTestAggregator(currentAgent);

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
    const aggregator = createTestAggregator(currentAgent);

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
    const aggregator = createTestAggregator(currentAgent);

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
    const aggregator = createTestAggregator(currentAgent);

    aggregator.ingest(makeToolCallEvent(PartStatus.COMPLETED));

    const snap = aggregator.snapshot();
    assert.equal(snap.totals.toolCalls, 1);
    assert.equal(snap.totals.toolErrors, 0);
    assert.equal(snap.byAgent["coder"].toolCalls, 1);
  });

  it("ingests tool_call error", () => {
    const currentAgent = new Map([["sess-1", "coder"]]);
    const aggregator = createTestAggregator(currentAgent);

    aggregator.ingest(makeToolCallEvent(PartStatus.ERROR));

    const snap = aggregator.snapshot();
    assert.equal(snap.totals.toolCalls, 1);
    assert.equal(snap.totals.toolErrors, 1);
    assert.equal(snap.byAgent["coder"].toolErrors, 1);
  });

  it("ingests session_created and updates firstSeenAt/lastSeenAt window", () => {
    const aggregator = createTestAggregator(new Map());

    aggregator.ingest(makeSessionCreatedEvent("sess-A"));

    const snap = aggregator.snapshot();
    assert.equal(snap.totals.sessionsCreated, 1);
    assert.ok(snap.window.firstSeenAt > 0);
    assert.ok(snap.window.lastSeenAt >= snap.window.firstSeenAt);
    assert.ok("sess-A" in snap.bySession);
  });

  it("returns zeroed snapshot for fresh aggregator", () => {
    const aggregator = createTestAggregator(new Map());

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
    assert.deepEqual(snap.byTool, {});
    assert.deepEqual(snap.errors, []);
    assert.equal(snap.totals.sessionErrors, 0);
  });

  it("ingests tool_call with tool name into byTool", () => {
    const currentAgent = new Map([["sess-1", "coder"]]);
    const aggregator = createTestAggregator(currentAgent);

    aggregator.ingest(
      makeToolCallEvent(PartStatus.COMPLETED, { tool: "bash" }),
    );
    aggregator.ingest(
      makeToolCallEvent(PartStatus.COMPLETED, { tool: "read" }),
    );
    aggregator.ingest(makeToolCallEvent(PartStatus.ERROR, { tool: "bash" }));

    const snap = aggregator.snapshot();
    assert.equal(snap.byTool["bash"].calls, 2);
    assert.equal(snap.byTool["bash"].errors, 1);
    assert.equal(snap.byTool["read"].calls, 1);
    assert.equal(snap.byTool["read"].errors, 0);
  });

  it("ingests session_error and records error entry", () => {
    const aggregator = createTestAggregator(new Map());

    aggregator.ingest(makeSessionErrorEvent());

    const snap = aggregator.snapshot();
    assert.equal(snap.totals.sessionErrors, 1);
    assert.equal(snap.errors.length, 1);
    assert.equal(snap.errors[0]!.type, "RuntimeError");
    assert.equal(snap.errors[0]!.sessionID, "sess-1");
  });

  it("reset() clears all state", () => {
    const currentAgent = new Map([["sess-1", "coder"]]);
    const aggregator = createTestAggregator(currentAgent);

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
    assert.equal(snap.totals.sessionErrors, 0);
    assert.equal(snap.window.firstSeenAt, 0);
    assert.equal(snap.window.lastSeenAt, 0);
    assert.deepEqual(snap.bySession, {});
    assert.deepEqual(snap.byTool, {});
    assert.deepEqual(snap.errors, []);
  });

  // ── Phase 2.5: byTool granular coverage ──────────────────────────────────

  it("byTool: tool completed adds to byTool", () => {
    const currentAgent = new Map([["sess-1", "coder"]]);
    const aggregator = createTestAggregator(currentAgent);

    aggregator.ingest(
      makeToolCallEvent(PartStatus.COMPLETED, { tool: "bash" }),
    );

    const snap = aggregator.snapshot();
    assert.ok("bash" in snap.byTool, "bash must be present in byTool");
    assert.equal(snap.byTool["bash"]!.calls, 1);
    assert.equal(snap.byTool["bash"]!.errors, 0);
    assert.equal(snap.byTool["bash"]!.durationMs, 100);
  });

  it("byTool: tool error increments errors", () => {
    const currentAgent = new Map([["sess-1", "coder"]]);
    const aggregator = createTestAggregator(currentAgent);

    aggregator.ingest(makeToolCallEvent(PartStatus.ERROR, { tool: "bash" }));

    const snap = aggregator.snapshot();
    assert.equal(snap.byTool["bash"]!.calls, 1);
    assert.equal(snap.byTool["bash"]!.errors, 1);
  });

  it("byTool: multiple tools are tracked separately", () => {
    const currentAgent = new Map([["sess-1", "coder"]]);
    const aggregator = createTestAggregator(currentAgent);

    aggregator.ingest(
      makeToolCallEvent(PartStatus.COMPLETED, { tool: "bash" }),
    );
    aggregator.ingest(
      makeToolCallEvent(PartStatus.COMPLETED, { tool: "read" }),
    );

    const snap = aggregator.snapshot();
    assert.equal(Object.keys(snap.byTool).length, 2);
    assert.equal(snap.byTool["bash"]!.calls, 1);
    assert.equal(snap.byTool["read"]!.calls, 1);
    assert.equal(snap.byTool["bash"]!.errors, 0);
    assert.equal(snap.byTool["read"]!.errors, 0);
  });

  // ── Phase 2.5: errors[] granular coverage ────────────────────────────────

  it("errors: llm_error pushes error entry", () => {
    const currentAgent = new Map([["sess-1", "coder"]]);
    const aggregator = createTestAggregator(currentAgent);

    aggregator.ingest(makeLlmErrorEvent());

    const snap = aggregator.snapshot();
    assert.equal(snap.errors.length, 1);
    assert.equal(snap.errors[0]!.type, "llm_error");
    assert.equal(snap.errors[0]!.sessionID, "sess-1");
    assert.equal(typeof snap.errors[0]!.timestamp, "number");
  });

  it("errors: tool_call error pushes error entry", () => {
    const currentAgent = new Map([["sess-1", "coder"]]);
    const aggregator = createTestAggregator(currentAgent);

    aggregator.ingest(makeToolCallEvent(PartStatus.ERROR, { tool: "bash" }));

    const snap = aggregator.snapshot();
    assert.equal(snap.errors.length, 1);
    assert.equal(snap.errors[0]!.type, "tool_error");
    assert.equal(snap.errors[0]!.sessionID, "sess-1");
  });

  it("errors: session_error pushes error entry with error name as type", () => {
    const aggregator = createTestAggregator(new Map());

    aggregator.ingest(
      makeSessionErrorEvent({
        sessionID: "sess-X",
        error: { name: "CustomBoom", data: "explode" },
      }),
    );

    const snap = aggregator.snapshot();
    assert.equal(snap.errors.length, 1);
    assert.equal(snap.errors[0]!.type, "CustomBoom");
    assert.equal(snap.errors[0]!.sessionID, "sess-X");
    // `data` is String()-coerced by the aggregator — a string passes through
    assert.equal(snap.errors[0]!.message, "explode");
  });

  it("errors: capped at 1000 entries", () => {
    const currentAgent = new Map([["sess-1", "coder"]]);
    const aggregator = createTestAggregator(currentAgent);

    for (let i = 0; i < 1001; i++) {
      aggregator.ingest(makeLlmErrorEvent());
    }

    const snap = aggregator.snapshot();
    assert.equal(snap.errors.length, 1000, "errors[] must cap at 1000");
    // the totals counter, however, is unbounded
    assert.equal(snap.totals.llmErrors, 1001);
  });

  // ── Phase 2.5: snapshot() filter options ─────────────────────────────────

  it("snapshot({ since }): returns zeroed when window is before since", () => {
    const currentAgent = new Map([["sess-1", "coder"]]);
    const aggregator = createTestAggregator(currentAgent);

    aggregator.ingest(makeLlmCallEvent());
    aggregator.ingest(
      makeToolCallEvent(PartStatus.COMPLETED, { tool: "bash" }),
    );
    aggregator.ingest(makeLlmErrorEvent());

    // since is in the future — the window is entirely before it
    const snap = aggregator.snapshot({ since: Date.now() + 1_000_000 });

    assert.equal(snap.totals.llmCalls, 0);
    assert.equal(snap.totals.cost, 0);
    assert.equal(snap.totals.toolCalls, 0);
    assert.equal(snap.totals.llmErrors, 0);
    assert.deepEqual(snap.bySession, {});
    assert.deepEqual(snap.byAgent, {});
    assert.deepEqual(snap.byModel, {});
    assert.deepEqual(snap.byAgentModel, {});
    assert.deepEqual(snap.byTool, {});
    assert.deepEqual(snap.errors, []);
  });

  it("snapshot({ since }): returns data when window is after since", () => {
    const currentAgent = new Map([["sess-1", "coder"]]);
    const aggregator = createTestAggregator(currentAgent);

    aggregator.ingest(makeLlmCallEvent());

    const snap = aggregator.snapshot({ since: 0 });

    assert.equal(snap.totals.llmCalls, 1);
    assert.equal(snap.totals.cost, 0.002);
    assert.equal(snap.bySession["sess-1"]!.llmCalls, 1);
  });

  it("snapshot({ sessionID }): returns only that session's aggregates", () => {
    const currentAgent = new Map([
      ["sess-1", "coder"],
      ["sess-2", "reviewer"],
    ]);
    const aggregator = createTestAggregator(currentAgent);

    aggregator.ingest(makeLlmCallEvent({ sessionID: "sess-1" }));
    aggregator.ingest(makeLlmCallEvent({ sessionID: "sess-2", cost: 0.003 }));

    const snap = aggregator.snapshot({ sessionID: "sess-1" });

    assert.equal(Object.keys(snap.bySession).length, 1);
    assert.ok("sess-1" in snap.bySession);
    assert.equal(snap.bySession["sess-1"]!.llmCalls, 1);
    assert.equal(snap.bySession["sess-1"]!.cost, 0.002);
    assert.equal(snap.bySession["sess-2"], undefined);
    // session-filtered view zeros the cross-cutting maps
    assert.deepEqual(snap.byAgent, {});
    assert.deepEqual(snap.byModel, {});
    assert.deepEqual(snap.byTool, {});
    // totals are global and preserved
    assert.equal(snap.totals.llmCalls, 2);
  });

  it("snapshot({ sessionID }): returns empty bySession when session not found", () => {
    const currentAgent = new Map([["sess-1", "coder"]]);
    const aggregator = createTestAggregator(currentAgent);

    aggregator.ingest(makeLlmCallEvent({ sessionID: "sess-1" }));

    const snap = aggregator.snapshot({ sessionID: "nonexistent" });

    assert.deepEqual(snap.bySession, {});
    // totals are NOT zeroed — they reflect global state
    assert.equal(snap.totals.llmCalls, 1);
  });

  it("snapshot({ groupBy: 'agent' }): returns only byAgent", () => {
    const currentAgent = new Map([["sess-1", "coder"]]);
    const aggregator = createTestAggregator(currentAgent);

    aggregator.ingest(makeLlmCallEvent());
    aggregator.ingest(
      makeToolCallEvent(PartStatus.COMPLETED, { tool: "bash" }),
    );

    const snap = aggregator.snapshot({ groupBy: "agent" });

    assert.ok("coder" in snap.byAgent);
    assert.equal(snap.byAgent["coder"]!.llmCalls, 1);
    assert.deepEqual(snap.bySession, {});
    assert.deepEqual(snap.byModel, {});
    assert.deepEqual(snap.byTool, {});
    assert.deepEqual(snap.byAgentModel, {});
  });

  it("snapshot({ groupBy: 'tool' }): returns only byTool", () => {
    const currentAgent = new Map([["sess-1", "coder"]]);
    const aggregator = createTestAggregator(currentAgent);

    aggregator.ingest(
      makeToolCallEvent(PartStatus.COMPLETED, { tool: "bash" }),
    );
    aggregator.ingest(
      makeToolCallEvent(PartStatus.COMPLETED, { tool: "read" }),
    );

    const snap = aggregator.snapshot({ groupBy: "tool" });

    assert.equal(Object.keys(snap.byTool).length, 2);
    assert.equal(snap.byTool["bash"]!.calls, 1);
    assert.equal(snap.byTool["read"]!.calls, 1);
    assert.deepEqual(snap.byAgent, {});
    assert.deepEqual(snap.bySession, {});
    assert.deepEqual(snap.byModel, {});
  });

  it("snapshot({ top: 1 }): returns top-N sessions/agents/models by cost", () => {
    const currentAgent = new Map([
      ["sess-1", "coder"],
      ["sess-2", "reviewer"],
      ["sess-3", "tester"],
    ]);
    const aggregator = createTestAggregator(currentAgent);

    aggregator.ingest(makeLlmCallEvent({ sessionID: "sess-1", cost: 0.001 }));
    aggregator.ingest(
      makeLlmCallEvent({
        sessionID: "sess-2",
        providerID: "anthropic",
        modelID: "claude-3",
        cost: 0.005,
        tokens: { input: 1, output: 2, reasoning: 0, cache: { read: 0 } },
      }),
    );
    aggregator.ingest(makeLlmCallEvent({ sessionID: "sess-3", cost: 0.002 }));

    const snap = aggregator.snapshot({ top: 1 });

    assert.equal(Object.keys(snap.bySession).length, 1);
    assert.equal(snap.bySession["sess-2"]!.cost, 0.005);
    // byAgent also gets top-1 (reviewer was the only agent for sess-2)
    assert.equal(snap.byAgent["reviewer"]!.cost, 0.005);
    // byModel also gets top-1
    assert.equal(snap.byModel["anthropic/claude-3"]!.cost, 0.005);
  });

  it("snapshot(): backward-compat returns full snapshot with byTool and errors", () => {
    const currentAgent = new Map([["sess-1", "coder"]]);
    const aggregator = createTestAggregator(currentAgent);

    aggregator.ingest(
      makeToolCallEvent(PartStatus.COMPLETED, { tool: "bash" }),
    );
    aggregator.ingest(makeLlmErrorEvent());
    aggregator.ingest(
      makeSessionErrorEvent({
        sessionID: "sess-1",
        error: { name: "BoomError", data: { message: "oh no" } },
      }),
    );

    const snap = aggregator.snapshot();

    assert.ok("byTool" in snap, "snapshot() must include byTool key");
    assert.ok("errors" in snap, "snapshot() must include errors key");
    assert.ok(
      "byAgentModel" in snap,
      "snapshot() must include byAgentModel key",
    );
    assert.equal(snap.byTool["bash"]!.calls, 1);
    assert.equal(snap.errors.length, 2);
    assert.equal(snap.totals.sessionErrors, 1);
    assert.equal(snap.totals.toolCalls, 1);
    // unfiltered snapshot exposes every dimension
    assert.equal(Object.keys(snap.byAgent).length, 1);
    assert.equal(Object.keys(snap.bySession).length, 1);
    assert.equal(Object.keys(snap.byModel).length, 1);
  });
});
