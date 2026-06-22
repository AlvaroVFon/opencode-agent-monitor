import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { TraceEventType } from "../../shared/enums";
import type {
  LlmCallEvent,
  ToolCallEvent,
  SkillCallEvent,
  SessionErrorEvent,
  SessionCreatedEvent,
  AgentDelegationEvent,
} from "../../shared/trace-events.types";
import type { MetricsSnapshot } from "../../shared/metrics.types";
import { dashboardAggregator } from "../../cli/dashboard/dashboard-aggregator";

function emptySnapshot(): MetricsSnapshot {
  return {
    totals: {
      llmCalls: 0,
      llmErrors: 0,
      toolCalls: 0,
      toolErrors: 0,
      skillCalls: 0,
      skillErrors: 0,
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
    bySkill: {},
    errors: [],
    window: { firstSeenAt: 0, lastSeenAt: 0 },
    lastActiveAgent: null,
  };
}

describe("DashboardAggregator", () => {
  describe("build", () => {
    it("returns empty dashboard when no events are provided", () => {
      const data = dashboardAggregator.build(emptySnapshot(), []);

      assert.equal(data.isEmpty, true);
      assert.equal(data.sessionCount, 0);
      assert.deepEqual(data.costs, []);
      assert.deepEqual(data.tokens, []);
      assert.deepEqual(data.tools, []);
      assert.deepEqual(data.skills, []);
      assert.deepEqual(data.timeline, []);
      assert.deepEqual(data.errors, []);
      assert.ok(data.generatedAt > 0);
    });

    it("groups LlmCallEvent cost by sessionID and model", () => {
      const llm1: LlmCallEvent = {
        type: TraceEventType.LLM_CALL,
        sessionID: "ses-1",
        agent: "agent1",
        model: "gpt-4o",
        finish: "stop",
        inputTokens: 100,
        outputTokens: 50,
        reasoningTokens: 0,
        cacheRead: 0,
        cost: 0.02,
        durationMs: 500,
        timestamp: 100,
      };
      const llm2: LlmCallEvent = {
        type: TraceEventType.LLM_CALL,
        sessionID: "ses-1",
        agent: "agent1",
        model: "claude-3.5",
        finish: "stop",
        inputTokens: 200,
        outputTokens: 100,
        reasoningTokens: 10,
        cacheRead: 0,
        cost: 0.03,
        durationMs: 800,
        timestamp: 200,
      };
      const llm3: LlmCallEvent = {
        type: TraceEventType.LLM_CALL,
        sessionID: "ses-2",
        agent: "agent1",
        model: "gpt-4o",
        finish: "stop",
        inputTokens: 50,
        outputTokens: 25,
        reasoningTokens: 0,
        cacheRead: 0,
        cost: 0.01,
        durationMs: 300,
        timestamp: 150,
      };

      const snapshot = emptySnapshot();
      snapshot.totals.sessionsCreated = 2;

      const data = dashboardAggregator.build(snapshot, [llm1, llm2, llm3]);

      assert.equal(data.sessionCount, 2);
      assert.equal(data.isEmpty, false);

      // ses-1 has 2 calls: gpt-4o ($0.02) + claude-3.5 ($0.03) = $0.05 total
      const ses1Cost = data.costs.find((c) => c.sessionID === "ses-1");
      assert.ok(ses1Cost);
      assert.equal(ses1Cost.total, 0.05);
      assert.equal(ses1Cost.byModel["gpt-4o"], 0.02);
      assert.equal(ses1Cost.byModel["claude-3.5"], 0.03);

      // ses-2 has 1 call: gpt-4o ($0.01)
      const ses2Cost = data.costs.find((c) => c.sessionID === "ses-2");
      assert.ok(ses2Cost);
      assert.equal(ses2Cost.total, 0.01);
      assert.equal(ses2Cost.byModel["gpt-4o"], 0.01);
    });

    it("computes token buckets from LlmCallEvent per session", () => {
      const llm1: LlmCallEvent = {
        type: TraceEventType.LLM_CALL,
        sessionID: "ses-1",
        agent: "agent1",
        model: "gpt-4o",
        finish: "stop",
        inputTokens: 100,
        outputTokens: 50,
        reasoningTokens: 0,
        cacheRead: 0,
        cost: 0.01,
        durationMs: 500,
        timestamp: 100,
      };
      const llm2: LlmCallEvent = {
        type: TraceEventType.LLM_CALL,
        sessionID: "ses-1",
        agent: "agent1",
        model: "gpt-4o",
        finish: "stop",
        inputTokens: 30,
        outputTokens: 20,
        reasoningTokens: 5,
        cacheRead: 0,
        cost: 0.005,
        durationMs: 300,
        timestamp: 200,
      };
      const llm3: LlmCallEvent = {
        type: TraceEventType.LLM_CALL,
        sessionID: "ses-2",
        agent: "agent1",
        model: "claude-3.5",
        finish: "stop",
        inputTokens: 200,
        outputTokens: 100,
        reasoningTokens: 50,
        cacheRead: 0,
        cost: 0.03,
        durationMs: 1000,
        timestamp: 150,
      };

      const data = dashboardAggregator.build(emptySnapshot(), [
        llm1,
        llm2,
        llm3,
      ]);

      const ses1Token = data.tokens.find((t) => t.sessionID === "ses-1");
      assert.ok(ses1Token);
      assert.equal(ses1Token.input, 130);
      assert.equal(ses1Token.output, 70);
      assert.equal(ses1Token.reasoning, 5);

      const ses2Token = data.tokens.find((t) => t.sessionID === "ses-2");
      assert.ok(ses2Token);
      assert.equal(ses2Token.input, 200);
      assert.equal(ses2Token.output, 100);
      assert.equal(ses2Token.reasoning, 50);
    });

    it("groups ToolCallEvent into tool rows by name", () => {
      const tool1: ToolCallEvent = {
        type: TraceEventType.TOOL_CALL,
        sessionID: "ses-1",
        tool: "read_file",
        callID: "c1",
        status: "completed",
        durationMs: 100,
        timestamp: 100,
      };
      const tool2: ToolCallEvent = {
        type: TraceEventType.TOOL_CALL,
        sessionID: "ses-1",
        tool: "read_file",
        callID: "c2",
        status: "completed",
        durationMs: 200,
        timestamp: 200,
      };
      const tool3: ToolCallEvent = {
        type: TraceEventType.TOOL_CALL,
        sessionID: "ses-1",
        tool: "write_file",
        callID: "c3",
        status: "error",
        durationMs: 50,
        error: "Permission denied",
        timestamp: 150,
      };
      const tool4: ToolCallEvent = {
        type: TraceEventType.TOOL_CALL,
        sessionID: "ses-2",
        tool: "read_file",
        callID: "c4",
        status: "error",
        durationMs: 300,
        error: "Not found",
        timestamp: 250,
      };

      const data = dashboardAggregator.build(emptySnapshot(), [
        tool1,
        tool2,
        tool3,
        tool4,
      ]);

      const readFile = data.tools.find((t) => t.name === "read_file");
      assert.ok(readFile);
      assert.equal(readFile.calls, 3);
      assert.equal(readFile.errors, 1);
      assert.equal(readFile.durationMs, 600); // 100 + 200 + 300
      // cost is intentionally omitted — ToolCallEvent does not carry cost data

      const writeFile = data.tools.find((t) => t.name === "write_file");
      assert.ok(writeFile);
      assert.equal(writeFile.calls, 1);
      assert.equal(writeFile.errors, 1);
      assert.equal(writeFile.durationMs, 50);
      // cost is intentionally omitted — ToolCallEvent does not carry cost data
    });

    it("groups SkillCallEvent into skill rows by name", () => {
      const skill1: SkillCallEvent = {
        type: TraceEventType.SKILL_CALL,
        sessionID: "ses-1",
        skill: "analyze_code",
        status: "completed",
        durationMs: 500,
        timestamp: 100,
      };
      const skill2: SkillCallEvent = {
        type: TraceEventType.SKILL_CALL,
        sessionID: "ses-1",
        skill: "analyze_code",
        status: "error",
        durationMs: 200,
        error: "Analysis failed",
        timestamp: 200,
      };
      const skill3: SkillCallEvent = {
        type: TraceEventType.SKILL_CALL,
        sessionID: "ses-2",
        skill: "generate_docs",
        status: "completed",
        durationMs: 300,
        timestamp: 150,
      };

      const data = dashboardAggregator.build(emptySnapshot(), [
        skill1,
        skill2,
        skill3,
      ]);

      const analyze = data.skills.find((s) => s.name === "analyze_code");
      assert.ok(analyze);
      assert.equal(analyze.calls, 2);
      assert.equal(analyze.errors, 1);
      assert.equal(analyze.durationMs, 700);
      // cost is intentionally omitted — SkillCallEvent does not carry cost data

      const generate = data.skills.find((s) => s.name === "generate_docs");
      assert.ok(generate);
      assert.equal(generate.calls, 1);
      assert.equal(generate.errors, 0);
      assert.equal(generate.durationMs, 300);
      // cost is intentionally omitted — SkillCallEvent does not carry cost data
    });

    it("builds chronologically sorted timeline from all event types", () => {
      const evt1: LlmCallEvent = {
        type: TraceEventType.LLM_CALL,
        sessionID: "ses-1",
        agent: "agent1",
        model: "gpt-4o",
        finish: "stop",
        inputTokens: 100,
        outputTokens: 50,
        reasoningTokens: 0,
        cacheRead: 0,
        cost: 0.01,
        durationMs: 500,
        timestamp: 300,
      };
      const evt2: SessionCreatedEvent = {
        type: TraceEventType.SESSION_CREATED,
        sessionID: "ses-1",
        parentID: null,
        timestamp: 100,
      };
      const evt3: ToolCallEvent = {
        type: TraceEventType.TOOL_CALL,
        sessionID: "ses-1",
        tool: "read_file",
        callID: "c1",
        status: "completed",
        durationMs: 100,
        timestamp: 200,
      };

      const data = dashboardAggregator.build(emptySnapshot(), [
        evt1,
        evt2,
        evt3,
      ]);

      assert.equal(data.timeline.length, 3);
      assert.equal(data.timeline[0].timestamp, 100);
      assert.equal(data.timeline[0].type, TraceEventType.SESSION_CREATED);
      assert.equal(data.timeline[1].timestamp, 200);
      assert.equal(data.timeline[1].type, TraceEventType.TOOL_CALL);
      assert.equal(data.timeline[2].timestamp, 300);
      assert.equal(data.timeline[2].type, TraceEventType.LLM_CALL);
    });

    it("groups errors from ToolCallEvent, SkillCallEvent, and SessionErrorEvent", () => {
      const toolErr: ToolCallEvent = {
        type: TraceEventType.TOOL_CALL,
        sessionID: "ses-1",
        tool: "read_file",
        callID: "c1",
        status: "error",
        durationMs: 100,
        error: "File not found",
        timestamp: 100,
      };
      const skillErr: SkillCallEvent = {
        type: TraceEventType.SKILL_CALL,
        sessionID: "ses-1",
        skill: "analyze_code",
        status: "error",
        durationMs: 200,
        error: "Analysis failed",
        timestamp: 200,
      };
      const sessionErr: SessionErrorEvent = {
        type: TraceEventType.SESSION_ERROR,
        sessionID: "ses-2",
        errorType: "timeout",
        errorMessage: "Agent timed out",
        timestamp: 150,
      };
      // Also support the `error` field variant
      const sessionErr2: SessionErrorEvent = {
        type: TraceEventType.SESSION_ERROR,
        sessionID: "ses-3",
        error: "Critical failure",
        timestamp: 250,
      };

      const data = dashboardAggregator.build(emptySnapshot(), [
        toolErr,
        skillErr,
        sessionErr,
        sessionErr2,
      ]);

      // 4 error events: tool error, skill error, 2 session errors (different messages)
      assert.equal(data.errors.length, 4);

      const toolErrorEntry = data.errors.find((e) => e.tool === "read_file");
      assert.ok(toolErrorEntry);
      assert.equal(toolErrorEntry.message, "File not found");
      assert.deepEqual(toolErrorEntry.sessions, ["ses-1"]);

      const skillErrorEntry = data.errors.find(
        (e) => e.tool === "analyze_code",
      );
      assert.ok(skillErrorEntry);
      assert.equal(skillErrorEntry.message, "Analysis failed");
      assert.deepEqual(skillErrorEntry.sessions, ["ses-1"]);

      const sessionErrorEntry = data.errors.find(
        (e) => e.tool === "session_error",
      );
      assert.ok(sessionErrorEntry);
      // Should use errorMessage or error field
      assert.ok(sessionErrorEntry.message.length > 0);
      assert.deepEqual(sessionErrorEntry.sessions, ["ses-2"]);

      // The second session error should also be present
      const sessionErrorEntry2 = data.errors.find(
        (e) => e.message === "Critical failure",
      );
      assert.ok(sessionErrorEntry2);
      assert.deepEqual(sessionErrorEntry2.sessions, ["ses-3"]);
    });

    it("handles AgentDelegationEvent in timeline and ignores for other panels", () => {
      const deleg: AgentDelegationEvent = {
        type: TraceEventType.AGENT_DELEGATION,
        sessionID: "ses-1",
        timestamp: 100,
      };

      const data = dashboardAggregator.build(emptySnapshot(), [deleg]);

      assert.equal(data.isEmpty, false);
      assert.equal(data.timeline.length, 1);
      assert.equal(data.timeline[0].type, TraceEventType.AGENT_DELEGATION);
      assert.equal(data.costs.length, 0);
      assert.equal(data.tokens.length, 0);
      assert.equal(data.tools.length, 0);
      assert.equal(data.skills.length, 0);
      assert.equal(data.errors.length, 0);
    });

    it("aggregates events with mixed types correctly", () => {
      const llm: LlmCallEvent = {
        type: TraceEventType.LLM_CALL,
        sessionID: "ses-1",
        agent: "agent1",
        model: "gpt-4o",
        finish: "stop",
        inputTokens: 100,
        outputTokens: 50,
        reasoningTokens: 0,
        cacheRead: 0,
        cost: 0.02,
        durationMs: 500,
        timestamp: 100,
      };
      const tool: ToolCallEvent = {
        type: TraceEventType.TOOL_CALL,
        sessionID: "ses-1",
        tool: "read_file",
        callID: "c1",
        status: "completed",
        durationMs: 100,
        timestamp: 200,
      };
      const skill: SkillCallEvent = {
        type: TraceEventType.SKILL_CALL,
        sessionID: "ses-1",
        skill: "analyze_code",
        status: "completed",
        durationMs: 300,
        timestamp: 150,
      };

      const data = dashboardAggregator.build(emptySnapshot(), [
        llm,
        tool,
        skill,
      ]);

      assert.equal(data.isEmpty, false);
      assert.equal(data.costs.length, 1);
      assert.equal(data.tokens.length, 1);
      assert.equal(data.tools.length, 1);
      assert.equal(data.skills.length, 1);
      assert.equal(data.timeline.length, 3);
      assert.equal(data.errors.length, 0);
    });

    it("duplicate error messages from same tool across sessions merge sessions array", () => {
      const toolErr1: ToolCallEvent = {
        type: TraceEventType.TOOL_CALL,
        sessionID: "ses-1",
        tool: "read_file",
        callID: "c1",
        status: "error",
        durationMs: 100,
        error: "File not found",
        timestamp: 100,
      };
      const toolErr2: ToolCallEvent = {
        type: TraceEventType.TOOL_CALL,
        sessionID: "ses-2",
        tool: "read_file",
        callID: "c2",
        status: "error",
        durationMs: 200,
        error: "File not found",
        timestamp: 200,
      };
      const toolErr3: ToolCallEvent = {
        type: TraceEventType.TOOL_CALL,
        sessionID: "ses-3",
        tool: "write_file",
        callID: "c3",
        status: "error",
        durationMs: 50,
        error: "Permission denied",
        timestamp: 150,
      };

      const data = dashboardAggregator.build(emptySnapshot(), [
        toolErr1,
        toolErr2,
        toolErr3,
      ]);

      const readFileErr = data.errors.find(
        (e) => e.tool === "read_file" && e.message === "File not found",
      );
      assert.ok(readFileErr);
      assert.deepEqual(readFileErr.sessions, ["ses-1", "ses-2"]);

      const writeFileErr = data.errors.find(
        (e) => e.tool === "write_file" && e.message === "Permission denied",
      );
      assert.ok(writeFileErr);
      assert.deepEqual(writeFileErr.sessions, ["ses-3"]);
    });
  });
});
