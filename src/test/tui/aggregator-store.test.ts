import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { spawnSync } from "node:child_process";
import { AggregatorStore } from "../../tui/aggregator-store";
import type { Aggregate, MetricsSnapshot } from "../../shared/metrics.types";

// ---------------------------------------------------------------------------
// TraceEvent — the union type accepted by `store.ingest()`.
// ---------------------------------------------------------------------------
//
// Inlined here so the test file is self-contained and remains the only source
// of truth for the event shape during the TDD red phase. The shapes match
// the TraceEvent union produced by the JSONL tailer and consumed by
// `scripts/metrics.mts`.

type LlmCallEvent = {
  type: "llm_call";
  sessionID: string;
  agent: string;
  model: string;
  finish: string;
  inputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  cacheRead: number;
  cost: number;
  durationMs: number;
  timestamp: number;
};

type ToolCallEvent = {
  type: "tool_call";
  sessionID: string;
  tool: string;
  callID: string;
  status: "completed" | "error";
  durationMs: number;
  error?: string;
  timestamp: number;
};

type SessionCreatedEvent = {
  type: "session_created";
  sessionID: string;
  parentID: string | null;
  timestamp: number;
};

type SessionErrorEvent = {
  type: "session_error";
  sessionID: string;
  errorType?: string;
  errorMessage?: string;
  timestamp: number;
};

type AgentDelegationEvent = {
  type: "agent_delegation";
  timestamp: number;
  [key: string]: unknown;
};

type TraceEvent =
  | LlmCallEvent
  | ToolCallEvent
  | SessionCreatedEvent
  | SessionErrorEvent
  | AgentDelegationEvent;

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

// ---------------------------------------------------------------------------
// scripts/metrics.mts integration — write events to a temp dir, run the
// script with `--json`, and parse the resulting snapshot. Used by the
// replay test to assert that the store's aggregated state matches the
// canonical `aggregate()` implementation in scripts/metrics.mts.
// ---------------------------------------------------------------------------

// Shape of an Aggregate after scripts/metrics.mts' toJsonSafe() projection.
// We deliberately leave `durationMs` as `unknown` because the store does
// not track it (per spec); the comparison helpers below ignore it.

interface ScriptAggregate {
  llmCalls: number;
  llmErrors: number;
  toolCalls: number;
  toolErrors: number;
  tokens: {
    input: number;
    output: number;
    reasoning: number;
    cacheRead: number;
  };
  cost: number;
  durationMs: unknown;
}

interface ScriptSnapshot {
  totals: ScriptAggregate;
  byAgent: Record<string, ScriptAggregate>;
  byTool: Record<string, unknown>;
  bySession: Record<string, unknown>;
  errors: unknown[];
  window: { firstSeenAt: number; lastSeenAt: number };
}

const tempDirs: string[] = [];

function makeTempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "aggregator-store-test-"));
  tempDirs.push(dir);
  return dir;
}

function aggregateViaScript(events: TraceEvent[]): ScriptSnapshot {
  const dir = makeTempDir();
  const tracePath = path.join(dir, "trace.jsonl");
  const text =
    events.length === 0
      ? ""
      : events.map((e) => JSON.stringify(e)).join("\n") + "\n";
  fs.writeFileSync(tracePath, text);

  const scriptPath = path.join(process.cwd(), "scripts", "metrics.mts");
  const result = spawnSync(
    process.execPath,
    ["--import", "tsx", scriptPath, "--dir", dir, "--json"],
    { encoding: "utf8", timeout: 30_000 },
  );

  if (result.error) {
    throw new Error(
      `failed to spawn scripts/metrics.mts: ${result.error.message}`,
    );
  }
  if (result.status !== 0) {
    throw new Error(
      `scripts/metrics.mts exited with status ${result.status}\n` +
        `stdout:\n${result.stdout}\n` +
        `stderr:\n${result.stderr}`,
    );
  }
  return JSON.parse(result.stdout) as ScriptSnapshot;
}

function assertAggregateMatches(
  label: string,
  actual: Aggregate,
  expected: ScriptAggregate,
): void {
  assert.equal(actual.llmCalls, expected.llmCalls, `${label}.llmCalls`);
  assert.equal(actual.llmErrors, expected.llmErrors, `${label}.llmErrors`);
  assert.equal(actual.toolCalls, expected.toolCalls, `${label}.toolCalls`);
  assert.equal(actual.toolErrors, expected.toolErrors, `${label}.toolErrors`);
  assert.equal(actual.cost, expected.cost, `${label}.cost`);
  assert.equal(
    actual.tokens.input,
    expected.tokens.input,
    `${label}.tokens.input`,
  );
  assert.equal(
    actual.tokens.output,
    expected.tokens.output,
    `${label}.tokens.output`,
  );
  assert.equal(
    actual.tokens.reasoning,
    expected.tokens.reasoning,
    `${label}.tokens.reasoning`,
  );
  assert.equal(
    actual.tokens.cacheRead,
    expected.tokens.cacheRead,
    `${label}.tokens.cacheRead`,
  );
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      try {
        fs.rmSync(dir, { recursive: true, force: true });
      } catch {
        // best-effort cleanup
      }
    }
  }
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

  it("replay_from_jsonl_matches_scripts_metrics_aggregate: replaying a trace.jsonl produces a snapshot matching scripts/metrics.mts aggregate()", () => {
    const events: TraceEvent[] = [
      makeSessionCreatedEvent("sess-1", {
        timestamp: 1_700_000_000_000,
      }),
      makeLlmCallEvent({
        sessionID: "sess-1",
        agent: "coder",
        model: "openai/gpt-4",
        inputTokens: 100,
        outputTokens: 50,
        reasoningTokens: 5,
        cacheRead: 2,
        cost: 0.001,
        durationMs: 800,
        timestamp: 1_700_000_001_000,
      }),
      makeLlmCallEvent({
        sessionID: "sess-1",
        agent: "coder",
        model: "openai/gpt-4",
        inputTokens: 200,
        outputTokens: 80,
        reasoningTokens: 0,
        cacheRead: 0,
        cost: 0.002,
        durationMs: 1200,
        timestamp: 1_700_000_002_000,
      }),
      makeToolCallEvent("bash", "completed", {
        sessionID: "sess-1",
        callID: "call-1",
        durationMs: 250,
        timestamp: 1_700_000_003_000,
      }),
      makeToolCallEvent("bash", "error", {
        sessionID: "sess-1",
        callID: "call-2",
        durationMs: 500,
        timestamp: 1_700_000_004_000,
      }),
      makeLlmCallEvent({
        sessionID: "sess-2",
        agent: "reviewer",
        model: "anthropic/claude-3",
        inputTokens: 50,
        outputTokens: 25,
        reasoningTokens: 0,
        cacheRead: 0,
        cost: 0.003,
        durationMs: 600,
        timestamp: 1_700_000_005_000,
      }),
    ];

    // Replay via the store under test
    const store = new AggregatorStore();
    for (const e of events) store.ingest(e);
    const snap = store.snapshot();

    // Reference snapshot from scripts/metrics.mts
    const script = aggregateViaScript(events);

    // Same set of agent keys
    assert.deepEqual(
      Object.keys(snap.byAgent).sort(),
      Object.keys(script.byAgent).sort(),
      "byAgent keys must match scripts/metrics.mts output",
    );

    // Per-agent: shared fields only (drop script's durationMs)
    for (const agent of Object.keys(snap.byAgent)) {
      assertAggregateMatches(
        `byAgent[${agent}]`,
        snap.byAgent[agent]!,
        script.byAgent[agent]!,
      );
    }

    // Totals: shared fields only
    assertAggregateMatches("totals", snap.totals, script.totals);

    // Window
    assert.equal(snap.window.firstSeenAt, script.window.firstSeenAt);
    assert.equal(snap.window.lastSeenAt, script.window.lastSeenAt);
  });

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
