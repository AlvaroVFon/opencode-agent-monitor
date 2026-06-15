import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { EventType, PartStatus, PartType, Role } from "../../enums";
import { MetricsAggregator } from "../../metrics/metrics.aggregator";
import { MetricsAggregatorHelper } from "../../helpers/metrics-aggregator.helper";
import { createAgentMonitorStatsTool } from "../../tools/agent-monitor-stats.tool";

const mockContext = {
  sessionID: "test-session",
  messageID: "test-msg",
  agent: "test-agent",
  directory: "/tmp",
  worktree: "/tmp",
  abort: new AbortController().signal,
  metadata: () => {},
  ask: async () => {},
};

function seededAggregator(): MetricsAggregator {
  const currentAgent = new Map([["sess-1", "coder"]]);
  const agg = new MetricsAggregator(
    currentAgent,
    new MetricsAggregatorHelper(),
  );

  agg.ingest({
    type: EventType.MESSAGE_UPDATED,
    properties: {
      info: {
        role: Role.ASSISTANT,
        sessionID: "sess-1",
        finish: "stop",
        tokens: { input: 100, output: 200, reasoning: 10, cache: { read: 50 } },
        providerID: "openai",
        modelID: "gpt-4",
        cost: 0.015,
        time: { created: 1000, completed: 2000 },
      },
    },
  });

  agg.ingest({
    type: EventType.MESSAGE_PART_UPDATED,
    properties: {
      part: {
        type: PartType.TOOL,
        sessionID: "sess-1",
        callID: "call-1",
        tool: "bash",
        state: {
          status: PartStatus.COMPLETED,
          time: { start: 1000, end: 1100 },
        },
      },
    },
  });

  agg.ingest({
    type: EventType.SESSION_CREATED,
    properties: { info: { id: "sess-1", parentID: null } },
  });

  return agg;
}

describe("AgentMonitorStatsTool", () => {
  it("returns markdown table with totals", async () => {
    const toolDef = createAgentMonitorStatsTool(seededAggregator());
    const result = await toolDef.execute(
      { since: "all", format: "markdown" },
      mockContext,
    );

    assert.equal(typeof result, "string");
    const output = result as string;
    assert.ok(output.includes("## Agent Monitor Stats"));
    assert.ok(output.includes("| LLM Calls | 1 |"));
    assert.ok(output.includes("| Tool Calls | 1 |"));
    assert.ok(output.includes("| Cost | $0.0150 |"));
    assert.ok(output.includes("| Tokens (Input) | 100 |"));
    assert.ok(output.includes("| Tokens (Output) | 200 |"));
  });

  it("groups breakdown by agent", async () => {
    const toolDef = createAgentMonitorStatsTool(seededAggregator());
    const result = await toolDef.execute(
      { since: "all", format: "markdown", groupBy: "agent" },
      mockContext,
    );

    const output = result as string;
    assert.ok(output.includes("### By Agent"));
    assert.ok(output.includes("| coder |"));
    assert.ok(output.includes("$0.0150"));
  });

  it("groups breakdown by model", async () => {
    const toolDef = createAgentMonitorStatsTool(seededAggregator());
    const result = await toolDef.execute(
      { since: "all", format: "markdown", groupBy: "model" },
      mockContext,
    );

    const output = result as string;
    assert.ok(output.includes("### By Model"));
    assert.ok(output.includes("| openai/gpt-4 |"));
  });

  it("returns JSON format", async () => {
    const toolDef = createAgentMonitorStatsTool(seededAggregator());
    const result = await toolDef.execute(
      { since: "all", format: "json" },
      mockContext,
    );

    assert.equal(typeof result, "object");
    const obj = result as { output: string };
    const parsed = JSON.parse(obj.output);
    assert.equal(parsed.totals.llmCalls, 1);
    assert.equal(parsed.totals.tokens.input, 100);
    assert.equal(parsed.totals.cost, 0.015);
  });

  it("filters by sessionID", async () => {
    const agg = seededAggregator();

    agg.ingest({
      type: EventType.SESSION_CREATED,
      properties: { info: { id: "sess-2", parentID: null } },
    });

    const toolDef = createAgentMonitorStatsTool(agg);
    const result = await toolDef.execute(
      { since: "all", format: "json", groupBy: "agent", sessionID: "sess-2" },
      mockContext,
    );

    const obj = result as { output: string };
    const parsed = JSON.parse(obj.output);
    assert.equal(parsed.totals.sessionsCreated, 2);
  });

  it("returns empty marks when no data", async () => {
    const emptyAgg = new MetricsAggregator(
      new Map(),
      new MetricsAggregatorHelper(),
    );
    const toolDef = createAgentMonitorStatsTool(emptyAgg);

    const result = await toolDef.execute(
      { since: "all", format: "markdown" },
      mockContext,
    );

    const output = result as string;
    assert.ok(output.includes("| LLM Calls | 0 |"));
    assert.ok(output.includes("| Cost | $0.0000 |"));
  });
});
