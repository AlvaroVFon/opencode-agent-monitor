import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { cliAggregator } from "../../cli/aggregate";
import type { TraceEvent } from "../../shared/trace-events.types";

describe("aggregate", () => {
  it("returns zeroed snapshot for empty events", () => {
    const snap = cliAggregator.aggregate([]);
    assert.equal(snap.totals.llmCalls, 0);
    assert.equal(snap.totals.cost, 0);
    assert.equal(snap.totals.sessionsCreated, 0);
    assert.equal(snap.totals.sessionErrors, 0);
    assert.deepEqual(snap.byAgent, {});
    assert.deepEqual(snap.byTool, {});
    assert.deepEqual(snap.bySession, {});
    assert.deepEqual(snap.errors, []);
    assert.equal(snap.window.firstSeenAt, 0);
    assert.equal(snap.window.lastSeenAt, 0);
  });

  it("aggregates llm_call events", () => {
    const events: TraceEvent[] = [
      {
        type: "llm_call",
        sessionID: "s1",
        agent: "coder",
        model: "gpt-4",
        finish: "stop",
        inputTokens: 10,
        outputTokens: 20,
        reasoningTokens: 1,
        cacheRead: 5,
        cost: 0.002,
        durationMs: 800,
        timestamp: 1000,
      },
    ];
    const snap = cliAggregator.aggregate(events);
    assert.equal(snap.totals.llmCalls, 1);
    assert.equal(snap.totals.cost, 0.002);
    assert.equal(snap.totals.tokens.input, 10);
    assert.equal(snap.totals.tokens.output, 20);
    assert.equal(snap.byAgent["coder"].llmCalls, 1);
    assert.equal(snap.bySession["s1"].llmCalls, 1);
  });

  it("aggregates multiple agents separately", () => {
    const events: TraceEvent[] = [
      {
        type: "llm_call",
        sessionID: "s1",
        agent: "coder",
        model: "gpt-4",
        finish: "stop",
        inputTokens: 10,
        outputTokens: 20,
        reasoningTokens: 0,
        cacheRead: 0,
        cost: 0.001,
        durationMs: 100,
        timestamp: 1000,
      },
      {
        type: "llm_call",
        sessionID: "s1",
        agent: "reviewer",
        model: "gpt-4",
        finish: "stop",
        inputTokens: 5,
        outputTokens: 10,
        reasoningTokens: 0,
        cacheRead: 0,
        cost: 0.0005,
        durationMs: 50,
        timestamp: 2000,
      },
    ];
    const snap = cliAggregator.aggregate(events);
    assert.equal(Object.keys(snap.byAgent).length, 2);
    assert.equal(snap.byAgent["coder"].cost, 0.001);
    assert.equal(snap.byAgent["reviewer"].cost, 0.0005);
    assert.equal(snap.totals.llmCalls, 2);
    assert.equal(snap.totals.cost, 0.0015);
  });

  it("aggregates skill_call events", () => {
    const events: TraceEvent[] = [
      {
        type: "skill_call",
        sessionID: "s1",
        skill: "planner",
        status: "completed",
        durationMs: 300,
        timestamp: 1000,
      },
      {
        type: "skill_call",
        sessionID: "s1",
        skill: "planner",
        status: "error",
        durationMs: 100,
        error: "fail",
        timestamp: 2000,
      },
    ];
    const snap = cliAggregator.aggregate(events);
    assert.equal(snap.totals.skillCalls, 2);
    assert.equal(snap.totals.skillErrors, 1);
    assert.equal(snap.bySkill["planner"].calls, 2);
    assert.equal(snap.bySkill["planner"].errors, 1);
  });

  it("aggregates tool_call events", () => {
    const events: TraceEvent[] = [
      {
        type: "tool_call",
        sessionID: "s1",
        tool: "bash",
        callID: "c1",
        status: "completed",
        durationMs: 250,
        timestamp: 1000,
      },
      {
        type: "tool_call",
        sessionID: "s1",
        tool: "bash",
        callID: "c2",
        status: "error",
        durationMs: 100,
        error: "fail",
        timestamp: 2000,
      },
    ];
    const snap = cliAggregator.aggregate(events);
    assert.equal(snap.totals.toolCalls, 2);
    assert.equal(snap.totals.toolErrors, 1);
    assert.equal(snap.byTool["bash"].calls, 2);
    assert.equal(snap.byTool["bash"].errors, 1);
    assert.equal(snap.byTool["bash"].durationMs, 350);
  });

  it("aggregates session_created and session_error", () => {
    const events: TraceEvent[] = [
      {
        type: "session_created",
        sessionID: "s1",
        parentID: null,
        timestamp: 1000,
      },
      {
        type: "session_error",
        sessionID: "s1",
        errorType: "RuntimeError",
        errorMessage: "boom",
        timestamp: 2000,
      },
    ];
    const snap = cliAggregator.aggregate(events);
    assert.equal(snap.totals.sessionsCreated, 1);
    assert.equal(snap.totals.sessionErrors, 1);
    assert.equal(snap.errors.length, 1);
    assert.equal(snap.errors[0].type, "RuntimeError");
    assert.equal(snap.errors[0].message, "boom");
  });

  it("sets window firstSeenAt and lastSeenAt", () => {
    const events: TraceEvent[] = [
      {
        type: "session_created",
        sessionID: "s1",
        parentID: null,
        timestamp: 100,
      },
      {
        type: "session_created",
        sessionID: "s2",
        parentID: null,
        timestamp: 500,
      },
    ];
    const snap = cliAggregator.aggregate(events);
    assert.equal(snap.window.firstSeenAt, 100);
    assert.equal(snap.window.lastSeenAt, 500);
  });

  it("returns byModel and byAgentModel as empty objects", () => {
    const events: TraceEvent[] = [
      {
        type: "session_created",
        sessionID: "s1",
        parentID: null,
        timestamp: 100,
      },
    ];
    const snap = cliAggregator.aggregate(events);
    assert.deepEqual(snap.byModel, {});
    assert.deepEqual(snap.byAgentModel, {});
    assert.equal(snap.lastActiveAgent, null);
  });

  it("aggregates session_error with error field instead of errorMessage", () => {
    const events: TraceEvent[] = [
      {
        type: "session_error",
        sessionID: "s1",
        errorType: "UnknownError",
        error: "raw error string",
        timestamp: 1000,
      },
    ];
    const snap = cliAggregator.aggregate(events);
    assert.equal(snap.totals.sessionErrors, 1);
    assert.equal(snap.errors[0].message, "raw error string");
  });

  it("silently ignores agent_delegation events (fallthrough in event type dispatch)", () => {
    const events: TraceEvent[] = [
      {
        type: "agent_delegation",
        timestamp: 100,
      },
    ];
    const snap = cliAggregator.aggregate(events);
    assert.equal(snap.totals.llmCalls, 0);
    assert.equal(snap.totals.toolCalls, 0);
    assert.equal(snap.totals.sessionsCreated, 0);
    assert.equal(snap.totals.sessionErrors, 0);
    assert.equal(snap.window.firstSeenAt, 100);
    assert.equal(snap.window.lastSeenAt, 100);
  });

  it("aggregates with out-of-order timestamps covering both firstSeenAt conditions", () => {
    const events: TraceEvent[] = [
      {
        type: "llm_call",
        sessionID: "s1",
        agent: "coder",
        model: "gpt-4",
        finish: "stop",
        inputTokens: 10,
        outputTokens: 20,
        reasoningTokens: 0,
        cacheRead: 0,
        cost: 0.001,
        durationMs: 100,
        timestamp: 500,
      },
      {
        type: "llm_call",
        sessionID: "s2",
        agent: "coder",
        model: "gpt-4",
        finish: "stop",
        inputTokens: 5,
        outputTokens: 10,
        reasoningTokens: 0,
        cacheRead: 0,
        cost: 0.001,
        durationMs: 50,
        timestamp: 100,
      },
    ];
    const snap = cliAggregator.aggregate(events);
    assert.equal(snap.window.firstSeenAt, 100);
    assert.equal(snap.window.lastSeenAt, 500);
  });
});

describe("parseDuration", () => {
  it("returns null for 'all'", () => {
    assert.equal(cliAggregator.parseDuration("all"), null);
  });

  it("parses hours", () => {
    const result = cliAggregator.parseDuration("24h");
    assert.notEqual(result, null);
    assert.ok(typeof result === "number");
    assert.ok(result > 0);
    assert.equal(result, Date.now() - 24 * 3_600_000);
  });

  it("parses days", () => {
    const result = cliAggregator.parseDuration("7d");
    assert.notEqual(result, null);
    assert.ok(typeof result === "number");
    assert.equal(result, Date.now() - 7 * 86_400_000);
  });

  it("returns null for invalid format", () => {
    assert.equal(cliAggregator.parseDuration("invalid"), null);
    assert.equal(cliAggregator.parseDuration("5x"), null);
    assert.equal(cliAggregator.parseDuration(""), null);
  });
});

describe("filterEvents", () => {
  const events: TraceEvent[] = [
    {
      type: "llm_call",
      sessionID: "s1",
      agent: "coder",
      model: "gpt-4",
      finish: "stop",
      inputTokens: 10,
      outputTokens: 20,
      reasoningTokens: 0,
      cacheRead: 0,
      cost: 0.001,
      durationMs: 100,
      timestamp: 100,
    },
    {
      type: "llm_call",
      sessionID: "s2",
      agent: "coder",
      model: "gpt-4",
      finish: "stop",
      inputTokens: 10,
      outputTokens: 20,
      reasoningTokens: 0,
      cacheRead: 0,
      cost: 0.001,
      durationMs: 100,
      timestamp: 200,
    },
    {
      type: "session_created",
      sessionID: "s1",
      parentID: null,
      timestamp: 50,
    },
  ];

  it("returns all events when since is null", () => {
    const result = cliAggregator.filterEvents(events, null);
    assert.equal(result.length, 3);
  });

  it("filters events after timestamp", () => {
    const result = cliAggregator.filterEvents(events, 150);
    assert.equal(result.length, 1);
    assert.equal(result[0].sessionID, "s2");
  });

  it("filters by sessionID", () => {
    const result = cliAggregator.filterEvents(events, null, "s1");
    assert.equal(result.length, 2);
    for (const ev of result) {
      if ("sessionID" in ev) {
        assert.equal((ev as { sessionID: string }).sessionID, "s1");
      }
    }
  });

  it("combines since and sessionID", () => {
    const result = cliAggregator.filterEvents(events, 80, "s2");
    assert.equal(result.length, 1);
    assert.equal(result[0].sessionID, "s2");
  });

  it("returns empty when no events match", () => {
    const result = cliAggregator.filterEvents(events, 999);
    assert.equal(result.length, 0);
  });

  it("passes through agent_delegation events without sessionID", () => {
    const adEvents: TraceEvent[] = [
      {
        type: "agent_delegation",
        timestamp: 100,
      },
    ];
    const result = cliAggregator.filterEvents(adEvents, null, "s1");
    assert.equal(result.length, 1);
  });
});
