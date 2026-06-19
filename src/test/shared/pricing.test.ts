import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  PRICING_REGISTRY,
  calculateModelCost,
  type ModelPricing,
  type Usage,
} from "../../shared/pricing.js";

describe("calculateModelCost", () => {
  const gpt4o: ModelPricing = PRICING_REGISTRY.find(
    (m) => m.provider === "openai" && m.model === "gpt-4o",
  )!;

  const claudeSonnet: ModelPricing = PRICING_REGISTRY.find(
    (m) =>
      m.provider === "anthropic" && m.model === "claude-3-5-sonnet-20240620",
  )!;

  describe("basic usage (no cache, no reasoning)", () => {
    it("returns 0 for zero usage", () => {
      const usage: Usage = {
        inputTokens: 0,
        outputTokens: 0,
      };
      assert.equal(calculateModelCost(gpt4o, usage), 0);
    });

    it("calculates input cost only", () => {
      const usage: Usage = {
        inputTokens: 1_000_000,
        outputTokens: 0,
      };
      assert.equal(calculateModelCost(gpt4o, usage), 2.5);
    });

    it("calculates output cost only", () => {
      const usage: Usage = {
        inputTokens: 0,
        outputTokens: 1_000_000,
      };
      assert.equal(calculateModelCost(gpt4o, usage), 10.0);
    });

    it("calculates mixed input/output", () => {
      const usage: Usage = {
        inputTokens: 1_000_000,
        outputTokens: 500_000,
      };
      assert.equal(calculateModelCost(gpt4o, usage), 2.5 + 5.0);
    });
  });

  describe("cache tokens (input vs cacheRead are mutually exclusive)", () => {
    it("subtracts cacheRead from input — does not double-charge", () => {
      const usage: Usage = {
        inputTokens: 1_000_000,
        outputTokens: 0,
        cacheRead: 1_000_000,
      };
      const cost = calculateModelCost(gpt4o, usage);
      assert.equal(
        cost,
        1.25,
        "should only charge cacheRead rate, not input + cacheRead",
      );
    });

    it("applies input rate only to non-cached input", () => {
      const usage: Usage = {
        inputTokens: 2_000_000,
        outputTokens: 0,
        cacheRead: 1_000_000,
      };
      const cost = calculateModelCost(gpt4o, usage);
      assert.equal(cost, 2.5 + 1.25);
    });

    it("returns 0 for cache when pricing has no cacheRead1M", () => {
      const geminiFlash: ModelPricing = {
        provider: "google",
        model: "gemini-1.5-flash",
        input1M: 0.075,
        output1M: 0.3,
      };
      const usage: Usage = {
        inputTokens: 1_000_000,
        outputTokens: 0,
        cacheRead: 1_000_000,
      };
      const cost = calculateModelCost(geminiFlash, usage);
      assert.equal(
        cost,
        0,
        "no cache rate defined, so cache is treated as free",
      );
    });

    it("subtracts cacheWrite from input when cacheWrite1M is defined", () => {
      const pricing: ModelPricing = {
        provider: "anthropic",
        model: "test",
        input1M: 3.0,
        output1M: 15.0,
        cacheWrite1M: 3.75,
      };
      const usage: Usage = {
        inputTokens: 1_000_000,
        outputTokens: 0,
        cacheWrite: 1_000_000,
      };
      const cost = calculateModelCost(pricing, usage);
      assert.equal(cost, 3.75);
    });

    it("clamps billable input to 0 when cache exceeds input", () => {
      const usage: Usage = {
        inputTokens: 100,
        outputTokens: 0,
        cacheRead: 1_000_000,
      };
      const cost = calculateModelCost(gpt4o, usage);
      assert.equal(cost, 1.25, "should not produce negative input cost");
    });
  });

  describe("reasoning tokens", () => {
    it("charges reasoning at output rate by default (no reasoning1M)", () => {
      const usage: Usage = {
        inputTokens: 0,
        outputTokens: 100_000,
        reasoningTokens: 100_000,
      };
      const cost = calculateModelCost(gpt4o, usage);
      assert.equal(cost, 1.0 + 1.0);
    });

    it("charges reasoning at dedicated reasoning1M rate when defined", () => {
      const o1: ModelPricing = {
        provider: "openai",
        model: "o1-test",
        input1M: 15.0,
        output1M: 60.0,
        reasoning1M: 60.0,
      };
      const usage: Usage = {
        inputTokens: 0,
        outputTokens: 0,
        reasoningTokens: 1_000_000,
      };
      const cost = calculateModelCost(o1, usage);
      assert.equal(cost, 60.0);
    });
  });

  describe("realistic scenario (Anthropic Sonnet with cache)", () => {
    it("matches Anthropic's published pricing formula", () => {
      const usage: Usage = {
        inputTokens: 1_000_000,
        outputTokens: 100_000,
        cacheRead: 800_000,
      };
      const cost = calculateModelCost(claudeSonnet, usage);
      const billableInput = 200_000;
      const expected =
        (billableInput / 1_000_000) * 3.0 +
        (100_000 / 1_000_000) * 15.0 +
        (800_000 / 1_000_000) * 0.3;
      assert.equal(cost, expected);
    });
  });
});
