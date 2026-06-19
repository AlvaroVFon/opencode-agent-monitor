import { createMemo, createSignal, For, Show } from "solid-js";
import type { JSX } from "@opentui/solid";
import type { TuiThemeCurrent } from "@opencode-ai/plugin/tui";
import type { Aggregate, MetricsSnapshot } from "../../shared/metrics.types.js";
import { panelHeaderFormatter } from "../formatters/panel-header.formatter";
import { totalsRowFormatter } from "../formatters/totals-row.formatter";
import { agentNameFormatter } from "../formatters/agent-name.formatter";
import { durationFormatter } from "../formatters/duration.formatter";

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
  workDurationMs: number;
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
    workDurationMs: aggregate.workDurationMs,
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

let _collapsed = false;

export function AgentCostPanel(props: {
  snapshot: MetricsSnapshot;
  theme: TuiThemeCurrent;
}): JSX.Element {
  const [collapsed, setCollapsed] = createSignal(_collapsed);

  const rows = createMemo(() =>
    buildAgentRows(props.snapshot.byAgent, props.snapshot.byAgentModel ?? {}),
  );
  const totalCost = createMemo(() =>
    formatCost(rows().reduce((sum, r) => sum + r.costValue, 0)),
  );
  const agentCount = createMemo(
    () => Object.keys(props.snapshot.byAgent).length,
  );
  const tokenTotals = createMemo(() => {
    const t = props.snapshot.totals.tokens;
    return { input: formatNumber(t.input), output: formatNumber(t.output) };
  });
  const separator = createMemo(() => buildSeparator(28));

  const header = createMemo(() =>
    panelHeaderFormatter.format(collapsed(), totalCost(), agentCount()),
  );
  const totals = createMemo(() => totalsRowFormatter.format(props.snapshot));
  const activeAgent = createMemo(() => props.snapshot.lastActiveAgent);
  const hasTotalsErrors = createMemo(() => {
    const t = props.snapshot.totals;
    return t.llmErrors + t.toolErrors + (t.sessionErrors ?? 0) > 0;
  });

  return (
    <box flexDirection="column" padding={1}>
      {/* Title bar — clickable; toggles collapsed */}
      <box
        flexDirection="row"
        onMouseUp={() => {
          _collapsed = panelHeaderFormatter.toggleCollapsed(collapsed());
          setCollapsed(_collapsed);
        }}
      >
        <text>
          <span style={{ fg: props.theme.textMuted }}>
            {header().indicator}{" "}
          </span>
          <span style={{ fg: props.theme.warning, bold: true }}>
            {header().title}
          </span>
          <Show when={agentCount() > 0}>
            <span style={{ fg: props.theme.info }}> </span>
            <span style={{ fg: props.theme.warning }}>
              {header().agentCount}
            </span>
          </Show>
          <span style={{ fg: props.theme.textMuted }}> · </span>
          <span style={{ fg: props.theme.success }}>{header().totalCost}</span>
        </text>
      </box>

      {/* Token totals — always visible */}
      <box flexDirection="row" paddingLeft={1}>
        <text>
          <span style={{ fg: props.theme.textMuted }}>in </span>
          <span style={{ fg: props.theme.text }}>{tokenTotals().input}</span>
          <span style={{ fg: props.theme.textMuted }}>{"  ·  "}</span>
          <span style={{ fg: props.theme.textMuted }}> out </span>
          <span style={{ fg: props.theme.text }}>{tokenTotals().output}</span>
        </text>
      </box>

      {/* Separator (hidden when collapsed) */}
      <Show when={!collapsed()}>
        <text style={{ fg: props.theme.border }}>{separator()}</text>
      </Show>

      {/* Agent list or empty state (hidden when collapsed) */}
      <Show when={!collapsed()}>
        <Show
          when={rows().length > 0}
          fallback={
            <box paddingTop={1}>
              <text style={{ fg: props.theme.textMuted }}>No data yet</text>
            </box>
          }
        >
          <For each={rows()}>
            {(row) => {
              const isActive = activeAgent()?.name === row.name;
              const colorKey = agentNameFormatter.color(row.name);
              return (
                <box flexDirection="column" paddingTop={1}>
                  {/* Agent subtitle */}
                  <text>
                    <Show when={isActive}>
                      <span style={{ fg: props.theme.success }}>● </span>
                    </Show>
                    <span
                      style={{
                        fg: props.theme[colorKey],
                        ...(isActive ? {} : { dim: true }),
                      }}
                    >
                      {agentNameFormatter.capitalize(row.name)}
                    </span>
                    <Show when={row.workDurationMs > 0}>
                      <span style={{ fg: props.theme.textMuted }}>
                        {" "}
                        {durationFormatter.format(row.workDurationMs)}
                      </span>
                    </Show>
                    <span style={{ fg: props.theme.warning }}> {row.cost}</span>
                  </text>

                  {/* Per-model breakdown */}
                  <Show when={row.models.length > 0}>
                    <box flexDirection="column" paddingTop={0}>
                      <For each={row.models}>
                        {(model) => (
                          <text style={{ fg: props.theme.secondary }}>
                            {model.name}
                          </text>
                        )}
                      </For>
                    </box>
                  </Show>

                  {/* Per-model sub-separator */}
                  <Show when={row.models.length > 0}>
                    <box paddingLeft={1} paddingTop={0}>
                      <text style={{ fg: props.theme.borderSubtle }}>
                        {"─".repeat(30)}
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
                        <span style={{ fg: props.theme.textMuted }}>in </span>
                        <span style={{ fg: props.theme.text }}>
                          {row.input}
                        </span>
                      </text>
                      <text>
                        <span style={{ fg: props.theme.textMuted }}>avg </span>
                        <span style={{ fg: props.theme.text }}>
                          {row.avgCostPerCall}
                        </span>
                        <span style={{ fg: props.theme.textMuted }}>/call</span>
                      </text>
                    </box>
                    <box flexDirection="column" paddingLeft={3}>
                      <text>
                        <span style={{ fg: props.theme.textMuted }}>out </span>
                        <span style={{ fg: props.theme.text }}>
                          {row.output}
                        </span>
                      </text>
                      <text>
                        <span style={{ fg: props.theme.textMuted }}>call </span>
                        <span style={{ fg: props.theme.text }}>
                          {row.calls}
                        </span>
                      </text>
                      <text>
                        <span style={{ fg: props.theme.textMuted }}>
                          cache{" "}
                        </span>
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
                        <span style={{ fg: props.theme.error }}>err </span>
                        <span style={{ fg: props.theme.error }}>
                          {formatNumber(row.errors)}
                        </span>
                      </text>
                    </box>
                  </Show>
                </box>
              );
            }}
          </For>
        </Show>
      </Show>
    </box>
  );
}
