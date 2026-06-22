import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { CompareCommand } from "../../cli/commands/compare.command.js";
import type { LlmCallEvent } from "../../shared/trace-events.types.js";
import { TraceEventType } from "../../shared/enums.js";
import type { ModelPricing } from "../../shared/pricing.js";

function makeCall(overrides: Partial<LlmCallEvent> = {}): LlmCallEvent {
  return {
    type: TraceEventType.LLM_CALL,
    sessionID: "s1",
    agent: "test",
    model: "openai/gpt-4o",
    finish: "stop",
    inputTokens: 0,
    outputTokens: 0,
    reasoningTokens: 0,
    cacheRead: 0,
    cost: 0,
    durationMs: 0,
    timestamp: 0,
    ...overrides,
  };
}

describe("CompareCommand.simulateModel", () => {
  const gpt4o: ModelPricing = {
    provider: "openai",
    model: "gpt-4o",
    input1M: 2.5,
    output1M: 10.0,
    cacheRead1M: 1.25,
  };

  it("returns 0 cost for empty calls list", () => {
    const cmd = new CompareCommand();
    const row = cmd.simulateModel(gpt4o, []);
    assert.equal(row.cost, 0);
    assert.equal(row.diff, 0);
    assert.equal(row.diffPct, 0);
  });

  it("simulates cost per call instead of aggregated", () => {
    const cmd = new CompareCommand();
    const calls = [
      makeCall({ inputTokens: 1_000_000, outputTokens: 0, cost: 2.5 }),
      makeCall({ inputTokens: 1_000_000, outputTokens: 0, cost: 2.5 }),
    ];
    const row = cmd.simulateModel(gpt4o, calls);
    assert.equal(row.cost, 5.0, "2 calls × $2.50 input = $5.00");
    assert.equal(row.diff, 0, "real cost was 5.0, simulated is 5.0");
    assert.equal(row.diffPct, 0);
  });

  it("does not double-charge cache tokens", () => {
    const cmd = new CompareCommand();
    const calls = [
      makeCall({
        inputTokens: 1_000_000,
        outputTokens: 0,
        cacheRead: 1_000_000,
        cost: 1.25,
      }),
    ];
    const row = cmd.simulateModel(gpt4o, calls);
    assert.equal(row.cost, 1.25, "only cache rate should apply");
    assert.equal(row.diff, 0);
  });

  it("sums reasoning tokens at output rate when no reasoning1M", () => {
    const cmd = new CompareCommand();
    const calls = [
      makeCall({
        inputTokens: 0,
        outputTokens: 100_000,
        reasoningTokens: 100_000,
        cost: 1.0,
      }),
    ];
    const row = cmd.simulateModel(gpt4o, calls);
    assert.equal(row.cost, 1.0 + 1.0, "output + reasoning both at $10/M");
  });

  it("produces a non-zero diff when comparing to a different-priced model", () => {
    const cmd = new CompareCommand();
    const cheapModel: ModelPricing = {
      provider: "openai",
      model: "gpt-4o-mini",
      input1M: 0.15,
      output1M: 0.6,
      cacheRead1M: 0.075,
    };
    const calls = [
      makeCall({
        inputTokens: 1_000_000,
        outputTokens: 0,
        cost: 2.5,
      }),
    ];
    const row = cmd.simulateModel(cheapModel, calls);
    assert.equal(row.cost, 0.15);
    assert.equal(row.diff, -2.35);
    assert.ok(row.diffPct < -90);
  });
});
