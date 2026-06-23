import { costPanel } from "./cost";
import { tokensPanel } from "./tokens";
import { toolsSkillsPanel } from "./tools-skills";
import { timelinePanel } from "./timeline";
import { errorsPanel } from "./errors";
import { eventMetricsPanel } from "./event-metrics";

/**
 * Default panel set in registration (render) order.
 *
 * Panels appear in this sequence in the generated HTML output:
 *   1. Cost (bar chart)
 *   2. Tokens (stacked bar chart)
 *   3. Tools & Skills (doughnut chart + table)
 *   4. Timeline (per-session chronological groups)
 *   5. Event Metrics (aggregated event data)
 *   6. Errors (error table)
 */
export const defaultPanels = [
  costPanel,
  tokensPanel,
  toolsSkillsPanel,
  timelinePanel,
  eventMetricsPanel,
  errorsPanel,
] as const;
