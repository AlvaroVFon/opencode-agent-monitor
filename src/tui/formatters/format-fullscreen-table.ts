import type { Aggregate, MetricsSnapshot } from "../../shared/metrics.types";

function formatNumber(n: number): string {
  return n.toLocaleString("en-US");
}

function formatCost(n: number): string {
  return `$${n.toFixed(4)}`;
}

interface TableRow {
  agent: string;
  cost: string;
  ctx: string;
  input: string;
  output: string;
  calls: string;
  errors: string;
}

function buildRow(agent: string, aggregate: Aggregate): TableRow {
  const ctx =
    aggregate.tokens.input +
    aggregate.tokens.cacheRead +
    aggregate.tokens.reasoning;

  return {
    agent,
    cost: formatCost(aggregate.cost),
    ctx: formatNumber(ctx),
    input: formatNumber(aggregate.tokens.input),
    output: formatNumber(aggregate.tokens.output),
    calls: formatNumber(aggregate.llmCalls),
    errors: formatNumber(aggregate.llmErrors + aggregate.toolErrors),
  };
}

function sumRows(rows: TableRow[]): TableRow {
  const cost = rows.reduce(
    (sum, r) => sum + Number(r.cost.replace("$", "")),
    0,
  );
  const parse = (s: string) => Number(s.replace(/,/g, ""));

  return {
    agent: "TOTAL",
    cost: formatCost(cost),
    ctx: formatNumber(rows.reduce((sum, r) => sum + parse(r.ctx), 0)),
    input: formatNumber(rows.reduce((sum, r) => sum + parse(r.input), 0)),
    output: formatNumber(rows.reduce((sum, r) => sum + parse(r.output), 0)),
    calls: formatNumber(rows.reduce((sum, r) => sum + parse(r.calls), 0)),
    errors: formatNumber(rows.reduce((sum, r) => sum + parse(r.errors), 0)),
  };
}

function pad(col: string, width: number, align: "left" | "right"): string {
  return align === "left" ? col.padEnd(width, " ") : col.padStart(width, " ");
}

export function formatFullscreenTable(snapshot: MetricsSnapshot): string {
  const rows = Object.entries(snapshot.byAgent)
    .sort(([, a], [, b]) => b.cost - a.cost)
    .map(([agent, aggregate]) => buildRow(agent, aggregate));

  const total = sumRows(rows);

  const headers: TableRow = {
    agent: "Agent",
    cost: "Cost",
    ctx: "Ctx Tokens",
    input: "Input",
    output: "Output",
    calls: "Calls",
    errors: "Errors",
  };

  const widths = {
    agent: Math.max(
      headers.agent.length,
      ...rows.map((r) => r.agent.length),
      total.agent.length,
    ),
    cost: Math.max(
      headers.cost.length,
      ...rows.map((r) => r.cost.length),
      total.cost.length,
    ),
    ctx: Math.max(
      headers.ctx.length,
      ...rows.map((r) => r.ctx.length),
      total.ctx.length,
    ),
    input: Math.max(
      headers.input.length,
      ...rows.map((r) => r.input.length),
      total.input.length,
    ),
    output: Math.max(
      headers.output.length,
      ...rows.map((r) => r.output.length),
      total.output.length,
    ),
    calls: Math.max(
      headers.calls.length,
      ...rows.map((r) => r.calls.length),
      total.calls.length,
    ),
    errors: Math.max(
      headers.errors.length,
      ...rows.map((r) => r.errors.length),
      total.errors.length,
    ),
  };

  const formatLine = (r: TableRow) =>
    [
      pad(r.agent, widths.agent, "left"),
      pad(r.cost, widths.cost, "right"),
      pad(r.ctx, widths.ctx, "right"),
      pad(r.input, widths.input, "right"),
      pad(r.output, widths.output, "right"),
      pad(r.calls, widths.calls, "right"),
      pad(r.errors, widths.errors, "right"),
    ].join("  ");

  const lines: string[] = [formatLine(headers)];

  lines.push(
    [
      "".padEnd(widths.agent, "-"),
      "".padStart(widths.cost, "-"),
      "".padStart(widths.ctx, "-"),
      "".padStart(widths.input, "-"),
      "".padStart(widths.output, "-"),
      "".padStart(widths.calls, "-"),
      "".padStart(widths.errors, "-"),
    ].join("  "),
  );

  for (const row of rows) {
    lines.push(formatLine(row));
  }

  lines.push(
    [
      "".padEnd(widths.agent, "-"),
      "".padStart(widths.cost, "-"),
      "".padStart(widths.ctx, "-"),
      "".padStart(widths.input, "-"),
      "".padStart(widths.output, "-"),
      "".padStart(widths.calls, "-"),
      "".padStart(widths.errors, "-"),
    ].join("  "),
  );

  lines.push(formatLine(total));

  return lines.join("\n");
}
