import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { AgentMonitor } from "../agent-monitor";

describe("AgentMonitor plugin", () => {
  it("returns chat.params, event, and tool hooks", async () => {
    const plugin = await AgentMonitor(undefined as any);

    assert.equal(typeof plugin["chat.params"], "function");
    assert.equal(typeof plugin.event, "function");
    assert.equal(typeof plugin.tool?.agent_monitor_stats, "object");
    assert.equal(typeof plugin.tool?.agent_monitor_stats?.execute, "function");
  });

  it("does not throw when storing agent and dispatching event", async () => {
    const plugin = await AgentMonitor(undefined as any, {
      traceDir: "/tmp/test-traces",
    });

    await assert.doesNotReject(
      plugin["chat.params"](
        { sessionID: "sess-1", agent: "planner" } as any,
        {} as any,
      ),
    );

    await assert.doesNotReject(
      plugin.event({
        event: {
          type: "message.updated",
          properties: {
            info: {
              role: "assistant",
              sessionID: "sess-1",
              finish: "stop",
              tokens: {
                input: 1,
                output: 1,
                reasoning: 0,
                cache: { read: 0 },
              },
              providerID: "test",
              modelID: "test-model",
              cost: 0,
              time: { created: 0, completed: 1 },
            },
          },
        },
      }),
    );
  });
});
