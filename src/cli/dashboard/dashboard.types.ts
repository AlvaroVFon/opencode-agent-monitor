/**
 * Dashboard HTML Export — type contracts.
 *
 * These types define the `DashboardData` shape produced by
 * `DashboardAggregator.build()` and consumed by
 * `DashboardRenderer.render()`. Pure data, no logic.
 *
 * Each panel type maps to one section of the generated HTML report:
 * cost, tokens, tools/skills, timeline, and error summary.
 */
export type CostByModel = Record<string, number>;

export type SessionCost = {
  sessionID: string;
  total: number;
  byModel: CostByModel;
};

export type TokenBucket = {
  sessionID: string;
  input: number;
  output: number;
  reasoning: number;
};

export type ToolRow = {
  name: string;
  calls: number;
  errors: number;
  durationMs: number;
  /** ToolCallEvent / SkillCallEvent do not carry cost data — omitted when unavailable. */
  cost?: number;
};

export type TimelineRow = {
  sessionID: string;
  type: string;
  durationMs: number;
  timestamp: number;
};

export type ErrorRow = {
  tool: string;
  message: string;
  sessions: string[];
};

export type DashboardData = {
  generatedAt: number;
  sessionCount: number;
  costs: SessionCost[];
  tokens: TokenBucket[];
  tools: ToolRow[];
  skills: ToolRow[];
  timeline: TimelineRow[];
  errors: ErrorRow[];
  isEmpty: boolean;
};
