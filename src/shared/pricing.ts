export interface ModelPricing {
  provider: string;
  model: string;
  input1M: number;
  output1M: number;
  cacheRead1M?: number;
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
    cacheRead1M: 0.3, // Anthropic Prompt Caching is usually 10% of input
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
    input1M: 0.14, // DeepSeek V3 prices approx
    output1M: 0.28,
    cacheRead1M: 0.01,
  },
  {
    provider: "google",
    model: "gemini-1.5-flash",
    input1M: 0.075, // Gemini 1.5 Flash <128k
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
  reasoningTokens?: number;
}

export function calculateModelCost(
  pricing: ModelPricing,
  usage: Usage,
): number {
  const inputCost = (usage.inputTokens / 1_000_000) * pricing.input1M;
  const outputCost = (usage.outputTokens / 1_000_000) * pricing.output1M;
  const cacheReadCost =
    pricing.cacheRead1M && usage.cacheRead
      ? (usage.cacheRead / 1_000_000) * pricing.cacheRead1M
      : 0;
  const reasoningCost =
    pricing.reasoning1M && usage.reasoningTokens
      ? (usage.reasoningTokens / 1_000_000) * pricing.reasoning1M
      : 0;

  return inputCost + outputCost + cacheReadCost + reasoningCost;
}
