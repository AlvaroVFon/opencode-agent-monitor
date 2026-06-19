export interface ModelPricing {
  provider: string;
  model: string;
  input1M: number;
  output1M: number;
  cacheRead1M?: number;
  cacheWrite1M?: number;
  reasoning1M?: number;
}

export const PRICING_REGISTRY: ModelPricing[] = [
  {
    provider: "openai",
    model: "gpt-4o",
    input1M: 2.5,
    output1M: 10.0,
    cacheRead1M: 1.25,
  },
  {
    provider: "openai",
    model: "gpt-4o-mini",
    input1M: 0.15,
    output1M: 0.6,
    cacheRead1M: 0.075,
  },
  {
    provider: "openai",
    model: "o1-preview",
    input1M: 15.0,
    output1M: 60.0,
    cacheRead1M: 7.5,
  },
  {
    provider: "anthropic",
    model: "claude-3-5-sonnet-20240620",
    input1M: 3.0,
    output1M: 15.0,
    cacheRead1M: 0.3,
  },
  {
    provider: "anthropic",
    model: "claude-3-haiku-20240307",
    input1M: 0.25,
    output1M: 1.25,
    cacheRead1M: 0.03,
  },
  {
    provider: "deepseek",
    model: "deepseek-chat",
    input1M: 0.14,
    output1M: 0.28,
    cacheRead1M: 0.01,
  },
  {
    provider: "google",
    model: "gemini-1.5-flash",
    input1M: 0.075,
    output1M: 0.3,
  },
  {
    provider: "google",
    model: "gemini-1.5-pro",
    input1M: 3.5,
    output1M: 10.5,
  },
];

export interface Usage {
  inputTokens: number;
  outputTokens: number;
  cacheRead?: number;
  cacheWrite?: number;
  reasoningTokens?: number;
}

const ONE_MILLION = 1_000_000;

export function calculateModelCost(
  pricing: ModelPricing,
  usage: Usage,
): number {
  const cacheRead = usage.cacheRead ?? 0;
  const cacheWrite = usage.cacheWrite ?? 0;
  const reasoning = usage.reasoningTokens ?? 0;

  const billableInput = Math.max(0, usage.inputTokens - cacheRead - cacheWrite);

  const inputCost = (billableInput / ONE_MILLION) * pricing.input1M;

  const outputCost = (usage.outputTokens / ONE_MILLION) * pricing.output1M;

  const reasoningCost =
    pricing.reasoning1M !== undefined
      ? (reasoning / ONE_MILLION) * pricing.reasoning1M
      : (reasoning / ONE_MILLION) * pricing.output1M;

  const cacheReadCost =
    pricing.cacheRead1M !== undefined
      ? (cacheRead / ONE_MILLION) * pricing.cacheRead1M
      : 0;

  const cacheWriteCost =
    pricing.cacheWrite1M !== undefined
      ? (cacheWrite / ONE_MILLION) * pricing.cacheWrite1M
      : 0;

  return (
    inputCost + outputCost + reasoningCost + cacheReadCost + cacheWriteCost
  );
}
