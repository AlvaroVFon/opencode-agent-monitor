import { createMemo, For } from "solid-js";
import type { JSX } from "@opentui/solid";
import type { TuiThemeCurrent } from "@opencode-ai/plugin/tui";
import type { Aggregate } from "../../metrics/metrics.aggregator.interface.js";
import type { MetricsSnapshot } from "../../metrics/metrics.aggregator.interface.js";

type AgentRow = {
  name: string;
  cost: string;
  costValue: number;
  ctx: string;
  input: string;
  output: string;
  calls: string;
  errors: number;
  hasErrors: boolean;
};

function formatNumber(n: number): string {
  return n.toLocaleString("en-US");
}

function formatCost(n: number): string {
  return `$${n.toFixed(4)}`;
}

function buildAgentRow(
  name: string,
  aggregate: Aggregate,
): AgentRow {
  const ctx =
    aggregate.tokens.input +
    aggregate.tokens.cacheRead +
    aggregate.tokens.reasoning;
  const errors = aggregate.llmErrors + aggregate.toolErrors;
  return {
    name,
    cost: formatCost(aggregate.cost),
    costValue: aggregate.cost,
    ctx: formatNumber(ctx),
    input: formatNumber(aggregate.tokens.input),
    output: formatNumber(aggregate.tokens.output),
    calls: formatNumber(aggregate.llmCalls),
    errors,
    hasErrors: errors > 0,
  };
}

function buildAgentRows(
  byAgent: Record<string, Aggregate>,
): AgentRow[] {
  return Object.entries(byAgent)
    .sort(([, a], [, b]) => b.cost - a.cost)
    .map(([name, aggregate]) => buildAgentRow(name, aggregate));
}

function buildSeparator(width: number): string {
  return "─".repeat(Math.max(width, 12));
}

export function AgentCostPanel(props: {
  snapshot: MetricsSnapshot;
  sessionId?: string;
  theme: TuiThemeCurrent;
}): JSX.Element {
  const rows = createMemo(() => buildAgentRows(props.snapshot.byAgent));
  const totalCost = createMemo(() =>
    formatCost(
      rows().reduce((sum, r) => sum + r.costValue, 0),
    ),
  );
  const separator = createMemo(() => buildSeparator(28));

  return (
    <box flexDirection="column" padding={1}>
      {/* Title bar */}
      <text>
        <span style={{ fg: props.theme.accent }}>Agent Monitor</span>
        <span style={{ fg: props.theme.textMuted }}>  ·  </span>
        <span style={{ fg: props.theme.success }}>{totalCost()}</span>
      </text>

      {/* Separator */}
      <text style={{ fg: props.theme.border }}>{separator()}</text>

      {/* Agent list or empty state */}
      {rows().length === 0 ? (
        <box paddingTop={1}>
          <text style={{ fg: props.theme.textMuted }}>No data yet</text>
        </box>
      ) : (
        <For each={rows()}>
          {(row) => (
            <box flexDirection="column" paddingTop={1}>
              {/* Agent subtitle */}
              <text style={{ fg: props.theme.text }}>{row.name}</text>

              {/* Cost (accent) */}
              <box paddingLeft={1}>
                <text style={{ fg: props.theme.accent }}>{row.cost}</text>
              </box>

              {/* Metric grid: two columns */}
              <box flexDirection="row" paddingLeft={1} paddingTop={0}>
                <box flexDirection="column">
                  <text>
                    <span style={{ fg: props.theme.textMuted }}>ctx </span>
                    <span style={{ fg: props.theme.text }}>{row.ctx}</span>
                  </text>
                  <text>
                    <span style={{ fg: props.theme.textMuted }}>in  </span>
                    <span style={{ fg: props.theme.text }}>{row.input}</span>
                  </text>
                </box>
                <box flexDirection="column" paddingLeft={3}>
                  <text>
                    <span style={{ fg: props.theme.textMuted }}>out </span>
                    <span style={{ fg: props.theme.text }}>{row.output}</span>
                  </text>
                  <text>
                    <span style={{ fg: props.theme.textMuted }}>call</span>
                    <span style={{ fg: props.theme.text }}>{row.calls}</span>
                  </text>
                </box>
              </box>

              {/* Error indicator (only if errors > 0) */}
              {row.hasErrors && (
                <box paddingLeft={1}>
                  <text>
                    <span style={{ fg: props.theme.error }}>err  </span>
                    <span style={{ fg: props.theme.error }}>
                      {formatNumber(row.errors)}
                    </span>
                  </text>
                </box>
              )}
            </box>
          )}
        </For>
      )}
    </box>
  );
}
