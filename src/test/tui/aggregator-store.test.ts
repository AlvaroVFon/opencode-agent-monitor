import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import { AggregatorStore } from "../../tui/aggregator-store";
import type { Aggregate, MetricsSnapshot } from "../../shared/metrics.types";
import type {
  LlmCallEvent,
  ToolCallEvent,
  SessionCreatedEvent,
  SessionErrorEvent,
  AgentDelegationEvent,
  TraceEvent,
} from "../../shared/trace-events.types";

// ---------------------------------------------------------------------------
// Fixture builders — small helpers that produce events with sensible defaults
// so each test only has to specify the fields it cares about.
// ---------------------------------------------------------------------------

function makeLlmCallEvent(overrides: Partial<LlmCallEvent> = {}): LlmCallEvent {
  return {
    type: "llm_call",
    sessionID: "sess-1",
    agent: "coder",
    model: "openai/gpt-4",
    finish: "stop",
    inputTokens: 10,
    outputTokens: 20,
    reasoningTokens: 1,
    cacheRead: 5,
    cost: 0.002,
    durationMs: 800,
    timestamp: 1_700_000_000_000,
    ...overrides,
  };
}

function makeToolCallEvent(
  tool: string,
  status: "completed" | "error",
  overrides: Partial<ToolCallEvent> = {},
): ToolCallEvent {
  return {
    type: "tool_call",
    sessionID: "sess-1",
    tool,
    callID: `call-${tool}`,
    status,
    durationMs: 250,
    ...(status === "error" ? { error: "boom" } : {}),
    timestamp: 1_700_000_001_000,
    ...overrides,
  };
}

function makeSessionCreatedEvent(
  sessionID: string,
  overrides: Partial<SessionCreatedEvent> = {},
): SessionCreatedEvent {
  return {
    type: "session_created",
    sessionID,
    parentID: null,
    timestamp: 1_700_000_002_000,
    ...overrides,
  };
}

function makeSessionErrorEvent(
  sessionID: string,
  overrides: Partial<SessionErrorEvent> = {},
): SessionErrorEvent {
  return {
    type: "session_error",
    sessionID,
    errorType: "boom",
    timestamp: 1_700_000_003_000,
    ...overrides,
  };
}

function makeAgentDelegationEvent(
  overrides: Partial<AgentDelegationEvent> = {},
): AgentDelegationEvent {
  return {
    type: "agent_delegation",
    from: "agentA",
    to: "agentB",
    timestamp: 1_700_000_004_000,
    ...overrides,
  };
}

afterEach(() => {
  // no-op
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("AggregatorStore", () => {
  it("ingest_llm_call_updates_byAgent_and_totals: ingesting an llm_call event updates byAgent[agent].llmCalls, cost, tokens, and totals", () => {
    const store = new AggregatorStore();
    const event: LlmCallEvent = {
      type: "llm_call",
      sessionID: "sess-42",
      agent: "coder",
      model: "openai/gpt-4",
      finish: "stop",
      inputTokens: 120,
      outputTokens: 45,
      reasoningTokens: 7,
      cacheRead: 3,
      cost: 0.0042,
      durationMs: 850,
      timestamp: 1_700_000_123_456,
    };

    store.ingest(event);
    const snap = store.snapshot();

    // Totals — the sum across all ingested events (just one here).
    assert.equal(snap.totals.llmCalls, 1, "totals.llmCalls");
    assert.equal(snap.totals.llmErrors, 0, "totals.llmErrors");
    assert.equal(snap.totals.toolCalls, 0, "totals.toolCalls");
    assert.equal(snap.totals.toolErrors, 0, "totals.toolErrors");
    assert.equal(snap.totals.cost, 0.0042, "totals.cost");
    assert.equal(snap.totals.tokens.input, 120, "totals.tokens.input");
    assert.equal(snap.totals.tokens.output, 45, "totals.tokens.output");
    assert.equal(snap.totals.tokens.reasoning, 7, "totals.tokens.reasoning");
    assert.equal(snap.totals.tokens.cacheRead, 3, "totals.tokens.cacheRead");

    // byAgent — the bucket for the event's agent.
    assert.ok(
      "coder" in snap.byAgent,
      "byAgent must contain the event's agent name",
    );
    const coder = snap.byAgent["coder"]!;
    assert.equal(coder.llmCalls, 1, "byAgent[coder].llmCalls");
    assert.equal(coder.cost, 0.0042, "byAgent[coder].cost");
    assert.equal(coder.tokens.input, 120, "byAgent[coder].tokens.input");
    assert.equal(coder.tokens.output, 45, "byAgent[coder].tokens.output");
    assert.equal(coder.tokens.reasoning, 7, "byAgent[coder].tokens.reasoning");
    assert.equal(coder.tokens.cacheRead, 3, "byAgent[coder].tokens.cacheRead");

    // Window — only one event, so first === last === event.timestamp.
    assert.equal(snap.window.firstSeenAt, 1_700_000_123_456);
    assert.equal(snap.window.lastSeenAt, 1_700_000_123_456);
  });

  // replay_from_jsonl test removed along with scripts/metrics.mts
  // (superseded by CLI stats/export commands)

  it("stream_vs_batch_ingestion_produces_same_snapshot: one-by-one ingest equals batch ingest result", () => {
    const events: TraceEvent[] = [
      makeSessionCreatedEvent("sess-1", {
        timestamp: 1_700_000_000_000,
      }),
      makeLlmCallEvent({
        agent: "coder",
        model: "openai/gpt-4",
        inputTokens: 100,
        outputTokens: 50,
        reasoningTokens: 0,
        cacheRead: 0,
        cost: 0.001,
        durationMs: 800,
        timestamp: 1_700_000_001_000,
      }),
      makeToolCallEvent("bash", "completed", {
        callID: "call-1",
        durationMs: 250,
        timestamp: 1_700_000_002_000,
      }),
      makeLlmCallEvent({
        agent: "reviewer",
        model: "anthropic/claude-3",
        inputTokens: 30,
        outputTokens: 15,
        reasoningTokens: 0,
        cacheRead: 0,
        cost: 0.0005,
        durationMs: 400,
        timestamp: 1_700_000_003_000,
      }),
    ];

    // Stream: ingest one event at a time, snapshotting after each.
    const streamStore = new AggregatorStore();
    const streamSnapshots: MetricsSnapshot[] = [];
    for (const e of events) {
      streamStore.ingest(e);
      streamSnapshots.push(streamStore.snapshot());
    }
    const streamFinal = streamSnapshots[streamSnapshots.length - 1]!;

    // Batch: ingest all events in a single loop on a fresh store.
    const batchStore = new AggregatorStore();
    for (const e of events) batchStore.ingest(e);
    const batchFinal = batchStore.snapshot();

    // Both paths must produce the exact same final snapshot.
    assert.deepEqual(streamFinal, batchFinal);

    // Sanity: intermediate stream snapshots are non-decreasing in llmCalls.
    let prev = 0;
    for (const s of streamSnapshots) {
      assert.ok(
        s.totals.llmCalls >= prev,
        "totals.llmCalls must be monotonically non-decreasing across ingests",
      );
      prev = s.totals.llmCalls;
    }
  });

  it("empty_store_returns_zeroed_snapshot: fresh store returns zeroed totals and empty records", () => {
    const store = new AggregatorStore();
    const snap = store.snapshot();

    // Totals — every numeric field is 0
    assert.equal(snap.totals.llmCalls, 0);
    assert.equal(snap.totals.llmErrors, 0);
    assert.equal(snap.totals.toolCalls, 0);
    assert.equal(snap.totals.toolErrors, 0);
    assert.equal(snap.totals.cost, 0);
    assert.equal(snap.totals.sessionsCreated, 0);
    assert.deepEqual(snap.totals.tokens, {
      input: 0,
      output: 0,
      reasoning: 0,
      cacheRead: 0,
    });

    // Window — unobserved, both timestamps are 0
    assert.equal(snap.window.firstSeenAt, 0);
    assert.equal(snap.window.lastSeenAt, 0);

    // Records — empty objects
    assert.deepEqual(snap.byAgent, {});
    assert.deepEqual(snap.bySession, {});
    assert.deepEqual(snap.byModel, {});
    assert.deepEqual(snap.byAgentModel, {});

    // reset() must round-trip back to the same zeroed shape.
    store.ingest(makeLlmCallEvent({ agent: "coder", cost: 0.001 }));
    store.ingest(makeToolCallEvent("bash", "completed"));
    assert.equal(store.snapshot().totals.llmCalls, 1);
    assert.equal(store.snapshot().totals.toolCalls, 1);

    store.reset();
    const afterReset = store.snapshot();
    assert.equal(afterReset.totals.llmCalls, 0);
    assert.equal(afterReset.totals.toolCalls, 0);
    assert.deepEqual(afterReset.byAgent, {});
    assert.deepEqual(afterReset.bySession, {});
    assert.deepEqual(afterReset.byModel, {});
    assert.deepEqual(afterReset.byAgentModel, {});
    assert.equal(afterReset.window.firstSeenAt, 0);
    assert.equal(afterReset.window.lastSeenAt, 0);
  });

  it("byAgentModel splits aggregates by model per agent", () => {
    const store = new AggregatorStore();
    store.ingest(
      makeLlmCallEvent({
        agent: "coder",
        model: "openai/gpt-4",
        cost: 0.001,
      }),
    );
    store.ingest(
      makeLlmCallEvent({
        agent: "coder",
        model: "openai/gpt-4o-mini",
        cost: 0.0005,
      }),
    );
    store.ingest(
      makeLlmCallEvent({
        agent: "coder",
        model: "openai/gpt-4",
        cost: 0.002,
      }),
    );
    store.ingest(
      makeLlmCallEvent({
        agent: "reviewer",
        model: "anthropic/claude-3",
        cost: 0.003,
      }),
    );

    const snap = store.snapshot();

    // Two distinct agents
    assert.equal(Object.keys(snap.byAgentModel).length, 2);
    assert.ok("coder" in snap.byAgentModel);
    assert.ok("reviewer" in snap.byAgentModel);

    // coder has two models with correct per-model aggregates
    const coder = snap.byAgentModel["coder"]!;
    assert.equal(Object.keys(coder).length, 2);
    assert.equal(coder["openai/gpt-4"]!.llmCalls, 2);
    assert.equal(coder["openai/gpt-4"]!.cost, 0.003);
    assert.equal(coder["openai/gpt-4o-mini"]!.llmCalls, 1);
    assert.equal(coder["openai/gpt-4o-mini"]!.cost, 0.0005);

    // reviewer has one model
    const reviewer = snap.byAgentModel["reviewer"]!;
    assert.equal(Object.keys(reviewer).length, 1);
    assert.equal(reviewer["anthropic/claude-3"]!.llmCalls, 1);
    assert.equal(reviewer["anthropic/claude-3"]!.cost, 0.003);

    // reset() also clears byAgentModel
    store.reset();
    assert.deepEqual(store.snapshot().byAgentModel, {});
  });

  // -----------------------------------------------------------------------
  // bySkill — skill call aggregation
  // -----------------------------------------------------------------------

  it("ingest_skill_call_updates_bySkill: ingesting a skill_call event updates bySkill and totals", () => {
    const store = new AggregatorStore();

    store.ingest({
      type: "skill_call",
      sessionID: "sess-1",
      skill: "planner",
      status: "completed",
      durationMs: 300,
      timestamp: 1_700_000_000_000,
    });

    const snap = store.snapshot();
    assert.equal(snap.totals.skillCalls, 1, "totals.skillCalls");
    assert.equal(snap.totals.skillErrors, 0, "totals.skillErrors");
    assert.ok("planner" in snap.bySkill, "bySkill must contain planner");
    assert.equal(snap.bySkill["planner"]!.calls, 1);
    assert.equal(snap.bySkill["planner"]!.errors, 0);
    assert.equal(snap.bySkill["planner"]!.avgDurationMs, 300);
  });

  it("ingest_skill_call_error_increments_errors: error status increments skillErrors", () => {
    const store = new AggregatorStore();

    store.ingest({
      type: "skill_call",
      sessionID: "sess-1",
      skill: "planner",
      status: "error",
      durationMs: 100,
      error: "fail",
      timestamp: 1_700_000_000_000,
    });

    const snap = store.snapshot();
    assert.equal(snap.totals.skillCalls, 1);
    assert.equal(snap.totals.skillErrors, 1);
    assert.equal(snap.bySkill["planner"]!.calls, 1);
    assert.equal(snap.bySkill["planner"]!.errors, 1);
  });

  it("bySkill_reset_clears: reset() returns bySkill to empty", () => {
    const store = new AggregatorStore();
    store.ingest({
      type: "skill_call",
      sessionID: "sess-1",
      skill: "planner",
      status: "completed",
      durationMs: 300,
      timestamp: 1_700_000_000_000,
    });
    assert.equal(store.snapshot().totals.skillCalls, 1);

    store.reset();

    assert.deepEqual(store.snapshot().bySkill, {});
    assert.equal(store.snapshot().totals.skillCalls, 0);
  });

  // -----------------------------------------------------------------------
  // snapshot({ sessionID }) — filter data to a single session.
  // -----------------------------------------------------------------------

  it("snapshot_sessionID_filters_agents_to_session: byAgent only includes agents that had llm_calls in that session", () => {
    const store = new AggregatorStore();

    // Two sessions, each with different agents
    store.ingest(
      makeLlmCallEvent({
        sessionID: "sess-1",
        agent: "coder",
        cost: 0.001,
      }),
    );
    store.ingest(
      makeLlmCallEvent({
        sessionID: "sess-1",
        agent: "reviewer",
        cost: 0.002,
      }),
    );
    store.ingest(
      makeLlmCallEvent({
        sessionID: "sess-2",
        agent: "debugger",
        cost: 0.003,
      }),
    );

    const filtered = store.snapshot({ sessionID: "sess-1" });

    // byAgent only has coder and reviewer (agents from sess-1)
    assert.deepEqual(
      Object.keys(filtered.byAgent).sort(),
      ["coder", "reviewer"],
      "byAgent must only contain agents from sess-1",
    );
    assert.equal(
      filtered.byAgent["coder"]!.cost,
      0.001,
      "byAgent[coder].cost reflects sess-1 events",
    );
    assert.equal(
      filtered.byAgent["reviewer"]!.cost,
      0.002,
      "byAgent[reviewer].cost reflects sess-1 events",
    );
    // debugger is NOT in sess-1
    assert.ok(
      !("debugger" in filtered.byAgent),
      "byAgent must not contain debugger (from sess-2)",
    );
  });

  it("snapshot_sessionID_filters_errors_to_session: errors array is scoped to the given session", () => {
    const store = new AggregatorStore();

    store.ingest(
      makeToolCallEvent("bash", "error", {
        sessionID: "sess-1",
        error: "bash error",
      }),
    );
    store.ingest(
      makeSessionErrorEvent("sess-2", {
        errorType: "session failure",
      }),
    );

    const filtered = store.snapshot({ sessionID: "sess-1" });

    assert.equal(filtered.errors.length, 1, "errors must be scoped to sess-1");
    assert.equal(filtered.errors[0]!.message, "bash error");
  });

  it("snapshot_sessionID_returns_zeroed_for_missing_session: unknown sessionID returns zeroed snapshot", () => {
    const store = new AggregatorStore();
    store.ingest(makeLlmCallEvent({ sessionID: "sess-1", cost: 0.001 }));

    const filtered = store.snapshot({ sessionID: "unknown" });

    assert.equal(filtered.totals.llmCalls, 0, "totals must be zeroed");
    assert.deepEqual(filtered.byAgent, {}, "byAgent must be empty");
    assert.deepEqual(filtered.bySession, {}, "bySession must be empty");
    assert.deepEqual(filtered.byModel, {}, "byModel must be empty");
    assert.deepEqual(filtered.byAgentModel, {}, "byAgentModel must be empty");
    assert.deepEqual(filtered.byTool, {}, "byTool must be empty");
    assert.deepEqual(filtered.errors, [], "errors must be empty");
  });

  it("snapshot_sessionID_keeps_byAgentModel_for_session_agents: byAgentModel includes model breakdowns for agents in the session", () => {
    const store = new AggregatorStore();

    // Two agents in same session using different models
    store.ingest(
      makeLlmCallEvent({
        sessionID: "sess-1",
        agent: "coder",
        model: "openai/gpt-4",
        cost: 0.001,
      }),
    );
    store.ingest(
      makeLlmCallEvent({
        sessionID: "sess-1",
        agent: "coder",
        model: "openai/gpt-4o-mini",
        cost: 0.0005,
      }),
    );
    store.ingest(
      makeLlmCallEvent({
        sessionID: "sess-1",
        agent: "reviewer",
        model: "anthropic/claude-3",
        cost: 0.002,
      }),
    );
    // Another session — should be excluded
    store.ingest(
      makeLlmCallEvent({
        sessionID: "sess-2",
        agent: "debugger",
        model: "openai/gpt-4",
        cost: 0.003,
      }),
    );

    const filtered = store.snapshot({ sessionID: "sess-1" });

    assert.equal(
      Object.keys(filtered.byAgentModel).length,
      2,
      "byAgentModel must have 2 agents",
    );
    assert.ok(
      "coder" in filtered.byAgentModel,
      "coder must be in byAgentModel",
    );
    assert.ok(
      "reviewer" in filtered.byAgentModel,
      "reviewer must be in byAgentModel",
    );
    assert.ok(
      !("debugger" in filtered.byAgentModel),
      "debugger must not be in byAgentModel",
    );

    // coder's model breakdown reflects only sess-1 events
    const coderModels = filtered.byAgentModel["coder"]!;
    assert.equal(
      Object.keys(coderModels).length,
      2,
      "coder must have 2 models",
    );
    assert.equal(coderModels["openai/gpt-4"]!.llmCalls, 1);
    assert.equal(coderModels["openai/gpt-4o-mini"]!.llmCalls, 1);
  });

  it("snapshot_without_opts_returns_full_data: no opts returns same as current behavior", () => {
    const store = new AggregatorStore();
    store.ingest(
      makeLlmCallEvent({ sessionID: "sess-1", agent: "coder", cost: 0.001 }),
    );
    store.ingest(
      makeLlmCallEvent({ sessionID: "sess-2", agent: "reviewer", cost: 0.002 }),
    );

    const full = store.snapshot();
    const explicitFull = store.snapshot({});

    assert.deepEqual(explicitFull, full);
    assert.equal(Object.keys(full.byAgent).length, 2);
  });

  it("snapshot_sessionID_totals_reflect_session_aggregates: totals use per-session aggregate, not global", () => {
    const store = new AggregatorStore();

    store.ingest(
      makeLlmCallEvent({
        sessionID: "sess-1",
        agent: "coder",
        cost: 0.001,
        inputTokens: 100,
      }),
    );
    store.ingest(
      makeLlmCallEvent({
        sessionID: "sess-2",
        agent: "reviewer",
        cost: 0.002,
        inputTokens: 200,
      }),
    );

    const filtered = store.snapshot({ sessionID: "sess-1" });

    assert.equal(filtered.totals.llmCalls, 1, "totals.llmCalls per session");
    assert.equal(filtered.totals.cost, 0.001, "totals.cost per session");
    assert.equal(
      filtered.totals.tokens.input,
      100,
      "totals.tokens.input per session",
    );
    assert.equal(
      filtered.totals.sessionsCreated,
      1,
      "totals.sessionsCreated is 1 for a single session",
    );
  });
});

// ---------------------------------------------------------------------------
// lastActiveAgent — identifies the agent that most recently received an
// llm_call event (per spec tui-working-agent-dot.md).
//
// All assertions below will fail until AggregatorStore learns about the
// `lastActiveAgent` field, the MetricsSnapshot interface gains the matching
// property, and ingest/snapshot/reset implement the rules. That red signal is
// the expected TDD starting point for the implementer.
// ---------------------------------------------------------------------------

describe("lastActiveAgent", () => {
  it("lastActiveAgent_is_null_initially: a fresh store has lastActiveAgent === null on its snapshot", () => {
    const store = new AggregatorStore();
    const snap = store.snapshot();

    assert.equal(
      snap.lastActiveAgent,
      null,
      "snapshot.lastActiveAgent must be null before any event is ingested",
    );
  });

  it("llm_call_sets_lastActiveAgent: ingesting an llm_call sets lastActiveAgent to { name, timestamp }", () => {
    const store = new AggregatorStore();
    const ts = 1_700_000_123_456;

    store.ingest(
      makeLlmCallEvent({
        agent: "agentA",
        timestamp: ts,
      }),
    );

    const last = store.snapshot().lastActiveAgent;
    assert.ok(
      last !== null && last !== undefined,
      "snapshot.lastActiveAgent must be set after an llm_call",
    );
    assert.equal(last.name, "agentA", "lastActiveAgent.name");
    assert.equal(last.timestamp, ts, "lastActiveAgent.timestamp");
  });

  it("later_llm_call_for_different_agent_overrides: agentB with a later timestamp replaces agentA", () => {
    const store = new AggregatorStore();
    store.ingest(
      makeLlmCallEvent({
        agent: "agentA",
        timestamp: 1_700_000_000_100,
      }),
    );
    store.ingest(
      makeLlmCallEvent({
        agent: "agentB",
        timestamp: 1_700_000_000_200,
      }),
    );

    const last = store.snapshot().lastActiveAgent;
    assert.ok(
      last !== null && last !== undefined,
      "snapshot.lastActiveAgent must be set after two llm_calls",
    );
    assert.equal(last.name, "agentB", "lastActiveAgent.name");
    assert.equal(
      last.timestamp,
      1_700_000_000_200,
      "lastActiveAgent.timestamp",
    );
  });

  it("out_of_order_llm_call_with_earlier_timestamp_does_not_regress: an llm_call whose timestamp is older than the current lastActiveAgent must not change the field", () => {
    const store = new AggregatorStore();

    // Establish agentA as active at ts=100.
    store.ingest(
      makeLlmCallEvent({
        agent: "agentA",
        timestamp: 100,
      }),
    );

    // A later-arriving event for agentB at ts=50 must not regress the field.
    store.ingest(
      makeLlmCallEvent({
        agent: "agentB",
        timestamp: 50,
      }),
    );

    const last = store.snapshot().lastActiveAgent;
    assert.ok(
      last !== null && last !== undefined,
      "snapshot.lastActiveAgent must remain set",
    );
    assert.equal(
      last.name,
      "agentA",
      "lastActiveAgent.name must not regress to the earlier-timestamp agent",
    );
    assert.equal(
      last.timestamp,
      100,
      "lastActiveAgent.timestamp must not regress to the earlier timestamp",
    );
  });

  it("out_of_order_safety_with_three_events: among A(100), B(200), C(150) the field ends at B(200) regardless of arrival order", () => {
    const store = new AggregatorStore();

    // Arrival order: A(100) → B(200) → C(150). Highest timestamp wins.
    store.ingest(makeLlmCallEvent({ agent: "agentA", timestamp: 100 }));
    store.ingest(makeLlmCallEvent({ agent: "agentB", timestamp: 200 }));
    store.ingest(makeLlmCallEvent({ agent: "agentC", timestamp: 150 }));

    const last = store.snapshot().lastActiveAgent;
    assert.ok(
      last !== null && last !== undefined,
      "snapshot.lastActiveAgent must be set",
    );
    assert.equal(
      last.name,
      "agentB",
      "lastActiveAgent.name must be the agent with the highest timestamp",
    );
    assert.equal(last.timestamp, 200, "lastActiveAgent.timestamp");
  });

  it("tool_call_does_not_change_lastActiveAgent: a tool_call after an llm_call leaves the field alone", () => {
    const store = new AggregatorStore();
    store.ingest(
      makeLlmCallEvent({
        agent: "agentA",
        timestamp: 1_700_000_000_100,
      }),
    );
    store.ingest(
      makeToolCallEvent("bash", "completed", {
        sessionID: "sess-1",
        timestamp: 1_700_000_000_500,
      }),
    );

    const last = store.snapshot().lastActiveAgent;
    assert.ok(
      last !== null && last !== undefined,
      "snapshot.lastActiveAgent must remain set after a tool_call",
    );
    assert.equal(
      last.name,
      "agentA",
      "lastActiveAgent.name must not change on a tool_call",
    );
    assert.equal(
      last.timestamp,
      1_700_000_000_100,
      "lastActiveAgent.timestamp must not change on a tool_call",
    );
  });

  it("session_created_does_not_change_lastActiveAgent: a session_created after an llm_call leaves the field alone", () => {
    const store = new AggregatorStore();
    store.ingest(
      makeLlmCallEvent({
        agent: "agentA",
        timestamp: 1_700_000_000_100,
      }),
    );
    store.ingest(
      makeSessionCreatedEvent("sess-99", {
        timestamp: 1_700_000_000_500,
      }),
    );

    const last = store.snapshot().lastActiveAgent;
    assert.ok(
      last !== null && last !== undefined,
      "snapshot.lastActiveAgent must remain set after a session_created",
    );
    assert.equal(
      last.name,
      "agentA",
      "lastActiveAgent.name must not change on a session_created",
    );
    assert.equal(
      last.timestamp,
      1_700_000_000_100,
      "lastActiveAgent.timestamp must not change on a session_created",
    );
  });

  it("session_error_does_not_change_lastActiveAgent: a session_error after an llm_call leaves the field alone", () => {
    const store = new AggregatorStore();
    store.ingest(
      makeLlmCallEvent({
        agent: "agentA",
        timestamp: 1_700_000_000_100,
      }),
    );
    store.ingest(
      makeSessionErrorEvent("sess-99", {
        errorType: "boom",
        timestamp: 1_700_000_000_500,
      }),
    );

    const last = store.snapshot().lastActiveAgent;
    assert.ok(
      last !== null && last !== undefined,
      "snapshot.lastActiveAgent must remain set after a session_error",
    );
    assert.equal(
      last.name,
      "agentA",
      "lastActiveAgent.name must not change on a session_error",
    );
    assert.equal(
      last.timestamp,
      1_700_000_000_100,
      "lastActiveAgent.timestamp must not change on a session_error",
    );
  });

  it("agent_delegation_does_not_change_lastActiveAgent: an agent_delegation after an llm_call leaves the field alone", () => {
    const store = new AggregatorStore();
    store.ingest(
      makeLlmCallEvent({
        agent: "agentA",
        timestamp: 1_700_000_000_100,
      }),
    );
    store.ingest(
      makeAgentDelegationEvent({
        from: "agentA",
        to: "agentB",
        timestamp: 1_700_000_000_500,
      }),
    );

    const last = store.snapshot().lastActiveAgent;
    assert.ok(
      last !== null && last !== undefined,
      "snapshot.lastActiveAgent must remain set after an agent_delegation",
    );
    assert.equal(
      last.name,
      "agentA",
      "lastActiveAgent.name must not change on an agent_delegation",
    );
    assert.equal(
      last.timestamp,
      1_700_000_000_100,
      "lastActiveAgent.timestamp must not change on an agent_delegation",
    );
  });

  it("reset_clears_lastActiveAgent_to_null: reset() returns lastActiveAgent to null", () => {
    const store = new AggregatorStore();
    store.ingest(
      makeLlmCallEvent({
        agent: "agentA",
        timestamp: 1_700_000_000_100,
      }),
    );
    assert.ok(
      store.snapshot().lastActiveAgent !== null &&
        store.snapshot().lastActiveAgent !== undefined,
      "precondition: lastActiveAgent must be set before reset",
    );

    store.reset();

    assert.equal(
      store.snapshot().lastActiveAgent,
      null,
      "snapshot.lastActiveAgent must be null after reset()",
    );
  });

  it("snapshot_lastActiveAgent_is_cloned_on_subsequent_ingest: a stale snapshot's lastActiveAgent is not affected by later ingests", () => {
    const store = new AggregatorStore();
    store.ingest(
      makeLlmCallEvent({
        agent: "agentA",
        timestamp: 1_700_000_000_100,
      }),
    );

    // Snapshot #1 captures the current state.
    const snap1 = store.snapshot();
    const nameFromSnap1 = snap1.lastActiveAgent?.name;
    assert.equal(
      nameFromSnap1,
      "agentA",
      "precondition: snap1.lastActiveAgent.name === 'agentA'",
    );

    // A new llm_call supersedes the previous active agent.
    store.ingest(
      makeLlmCallEvent({
        agent: "agentB",
        timestamp: 1_700_000_000_200,
      }),
    );

    // The first snapshot must NOT reflect the new ingest (it must be a clone).
    assert.equal(
      snap1.lastActiveAgent?.name,
      "agentA",
      "snap1.lastActiveAgent.name must be unaffected by later ingests",
    );
    assert.equal(
      snap1.lastActiveAgent?.timestamp,
      1_700_000_000_100,
      "snap1.lastActiveAgent.timestamp must be unaffected by later ingests",
    );

    // The new snapshot reflects the new state.
    const snap2 = store.snapshot();
    assert.equal(
      snap2.lastActiveAgent?.name,
      "agentB",
      "snap2.lastActiveAgent.name must show the new agent",
    );
  });

  it("snapshot_lastActiveAgent_is_cloned_against_mutation: mutating a snapshot's lastActiveAgent must not affect subsequent snapshots", () => {
    const store = new AggregatorStore();
    store.ingest(
      makeLlmCallEvent({
        agent: "agentA",
        timestamp: 1_700_000_000_100,
      }),
    );

    // Take a snapshot and mutate its lastActiveAgent in place.
    const snap1 = store.snapshot();
    if (snap1.lastActiveAgent === null || snap1.lastActiveAgent === undefined) {
      throw new Error("precondition: lastActiveAgent must be set");
    }
    snap1.lastActiveAgent.name = "MUTATED";
    snap1.lastActiveAgent.timestamp = 999;

    // A fresh snapshot from the store must still show the original values.
    const snap2 = store.snapshot();
    assert.ok(
      snap2.lastActiveAgent !== null && snap2.lastActiveAgent !== undefined,
      "snap2.lastActiveAgent must remain set",
    );
    assert.equal(
      snap2.lastActiveAgent.name,
      "agentA",
      "snap2.lastActiveAgent.name must not be affected by mutating snap1",
    );
    assert.equal(
      snap2.lastActiveAgent.timestamp,
      1_700_000_000_100,
      "snap2.lastActiveAgent.timestamp must not be affected by mutating snap1",
    );
  });
});
