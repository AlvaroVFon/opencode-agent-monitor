import { createMemo, For, Show } from "solid-js";
import type { JSX } from "@opentui/solid";
import type { TuiThemeCurrent } from "@opencode-ai/plugin/tui";
import type {
  Aggregate,
  MetricsSnapshot,
} from "../../metrics/metrics.aggregator.interface.js";

type ModelRow = {
  name: string;
  cost: string;
  costValue: number;
  calls: number;
  callsLabel: string;
};

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
  models: ModelRow[];
  avgCostPerCall: string;
  cacheHitRate: string;
};

function formatNumber(n: number): string {
  return n.toLocaleString("en-US");
}

function formatCost(n: number): string {
  return `$${n.toFixed(4)}`;
}

function formatPercent(n: number): string {
  if (!Number.isFinite(n)) return "0%";
  return `${Math.round(n * 100)}%`;
}

function formatAvgCost(cost: number, calls: number): string {
  if (calls === 0) return "$0.0000";
  return `$${(cost / calls).toFixed(4)}`;
}

function buildModelRows(
  byAgentModel: Record<string, Record<string, Aggregate>> | undefined,
  agentName: string,
): ModelRow[] {
  const models = byAgentModel?.[agentName];
  if (!models) return [];
  return Object.entries(models)
    .sort(([, a], [, b]) => b.cost - a.cost)
    .map(([modelName, aggregate]) => ({
      name: modelName,
      cost: formatCost(aggregate.cost),
      costValue: aggregate.cost,
      calls: aggregate.llmCalls,
      callsLabel: `${formatNumber(aggregate.llmCalls)} call${aggregate.llmCalls === 1 ? "" : "s"}`,
    }));
}

function buildAgentRow(
  name: string,
  aggregate: Aggregate,
  modelRows: ModelRow[],
): AgentRow {
  const ctx =
    aggregate.tokens.input +
    aggregate.tokens.cacheRead +
    aggregate.tokens.reasoning;
  const errors = aggregate.llmErrors + aggregate.toolErrors;
  const totalInput = aggregate.tokens.input + aggregate.tokens.cacheRead;
  const cacheRate =
    totalInput === 0 ? 0 : aggregate.tokens.cacheRead / totalInput;
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
    models: modelRows,
    avgCostPerCall: formatAvgCost(aggregate.cost, aggregate.llmCalls),
    cacheHitRate: formatPercent(cacheRate),
  };
}

function buildAgentRows(
  byAgent: Record<string, Aggregate>,
  byAgentModel: Record<string, Record<string, Aggregate>>,
): AgentRow[] {
  return Object.entries(byAgent)
    .sort(([, a], [, b]) => b.cost - a.cost)
    .map(([name, aggregate]) =>
      buildAgentRow(name, aggregate, buildModelRows(byAgentModel, name)),
    );
}

function buildSeparator(width: number): string {
  return "─".repeat(Math.max(width, 28));
}

export function AgentCostPanel(props: {
  snapshot: MetricsSnapshot;
  sessionId?: string;
  theme: TuiThemeCurrent;
}): JSX.Element {
  const rows = createMemo(() =>
    buildAgentRows(props.snapshot.byAgent, props.snapshot.byAgentModel ?? {}),
  );
  const totalCost = createMemo(() =>
    formatCost(rows().reduce((sum, r) => sum + r.costValue, 0)),
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
      <Show
        when={rows().length > 0}
        fallback={
          <box paddingTop={1}>
            <text style={{ fg: props.theme.textMuted }}>No data yet</text>
          </box>
        }
      >
        <For each={rows()}>
          {(row) => (
            <box flexDirection="column" paddingTop={1}>
              {/* Agent subtitle */}
              <text style={{ fg: props.theme.text }}>{row.name}</text>

              {/* Cost (accent) */}
              <box paddingLeft={1}>
                <text style={{ fg: props.theme.accent }}>{row.cost}</text>
              </box>

              {/* Per-model breakdown */}
              <Show when={row.models.length > 0}>
                <box flexDirection="column" paddingLeft={2} paddingTop={0}>
                  <For each={row.models}>
                    {(model) => (
                      <text>
                        <span style={{ fg: props.theme.secondary }}>
                          {model.name}
                        </span>
                        <span style={{ fg: props.theme.textMuted }}>
                          {"  ·  "}
                        </span>
                        <span style={{ fg: props.theme.textMuted }}>
                          {model.callsLabel}
                        </span>
                        <span style={{ fg: props.theme.textMuted }}>
                          {"  ·  "}
                        </span>
                        <span style={{ fg: props.theme.text }}>
                          {model.cost}
                        </span>
                      </text>
                    )}
                  </For>
                </box>
              </Show>

              {/* Per-model sub-separator */}
              <Show when={row.models.length > 0}>
                <box paddingLeft={1} paddingTop={0}>
                  <text style={{ fg: props.theme.borderSubtle }}>
                    {"─".repeat(20)}
                  </text>
                </box>
              </Show>

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

              {/* Derived metrics row */}
              <box flexDirection="row" paddingLeft={1} paddingTop={0}>
                <text>
                  <span style={{ fg: props.theme.textMuted }}>avg </span>
                  <span style={{ fg: props.theme.text }}>
                    {row.avgCostPerCall}
                  </span>
                  <span style={{ fg: props.theme.textMuted }}>/call</span>
                </text>
                <box paddingLeft={2}>
                  <text>
                    <span style={{ fg: props.theme.textMuted }}>cache </span>
                    <span style={{ fg: props.theme.info }}>
                      {row.cacheHitRate}
                    </span>
                  </text>
                </box>
              </box>

              {/* Error indicator (only if errors > 0) */}
              <Show when={row.hasErrors}>
                <box paddingLeft={1}>
                  <text>
                    <span style={{ fg: props.theme.error }}>err  </span>
                    <span style={{ fg: props.theme.error }}>
                      {formatNumber(row.errors)}
                    </span>
                  </text>
                </box>
              </Show>
            </box>
          )}
        </For>
      </Show>
    </box>
  );
}
