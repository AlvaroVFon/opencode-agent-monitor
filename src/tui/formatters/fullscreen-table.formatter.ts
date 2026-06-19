import type {
  Aggregate,
  MetricsSnapshot,
  SkillStats,
} from "../../shared/metrics.types";

interface TableRow {
  agent: string;
  cost: string;
  ctx: string;
  input: string;
  output: string;
  calls: string;
  errors: string;
}

export class FullscreenTableFormatter {
  private formatNumber(n: number): string {
    return n.toLocaleString("en-US");
  }

  private formatCost(n: number): string {
    return `$${n.toFixed(4)}`;
  }

  private buildRow(agent: string, aggregate: Aggregate): TableRow {
    const ctx =
      aggregate.tokens.input +
      aggregate.tokens.cacheRead +
      aggregate.tokens.reasoning;

    return {
      agent,
      cost: this.formatCost(aggregate.cost),
      ctx: this.formatNumber(ctx),
      input: this.formatNumber(aggregate.tokens.input),
      output: this.formatNumber(aggregate.tokens.output),
      calls: this.formatNumber(aggregate.llmCalls),
      errors: this.formatNumber(aggregate.llmErrors + aggregate.toolErrors),
    };
  }

  private sumRows(rows: TableRow[]): TableRow {
    const cost = rows.reduce(
      (sum, r) => sum + Number(r.cost.replace("$", "")),
      0,
    );
    const parse = (s: string) => Number(s.replace(/,/g, ""));

    return {
      agent: "TOTAL",
      cost: this.formatCost(cost),
      ctx: this.formatNumber(rows.reduce((sum, r) => sum + parse(r.ctx), 0)),
      input: this.formatNumber(
        rows.reduce((sum, r) => sum + parse(r.input), 0),
      ),
      output: this.formatNumber(
        rows.reduce((sum, r) => sum + parse(r.output), 0),
      ),
      calls: this.formatNumber(
        rows.reduce((sum, r) => sum + parse(r.calls), 0),
      ),
      errors: this.formatNumber(
        rows.reduce((sum, r) => sum + parse(r.errors), 0),
      ),
    };
  }

  private pad(col: string, width: number, align: "left" | "right"): string {
    return align === "left" ? col.padEnd(width, " ") : col.padStart(width, " ");
  }

  format(snapshot: MetricsSnapshot): string {
    const rows = Object.entries(snapshot.byAgent)
      .sort(([, a], [, b]) => b.cost - a.cost)
      .map(([agent, aggregate]) => this.buildRow(agent, aggregate));

    const total = this.sumRows(rows);

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
        this.pad(r.agent, widths.agent, "left"),
        this.pad(r.cost, widths.cost, "right"),
        this.pad(r.ctx, widths.ctx, "right"),
        this.pad(r.input, widths.input, "right"),
        this.pad(r.output, widths.output, "right"),
        this.pad(r.calls, widths.calls, "right"),
        this.pad(r.errors, widths.errors, "right"),
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

    const skillKeys = Object.keys(snapshot.bySkill).sort();
    if (skillKeys.length > 0) {
      lines.push("");
      lines.push("--- By Skill ---");
      const skillHeader = ["Skill", "Calls", "Errors", "Avg Duration (ms)"];
      const skillRows = skillKeys.map((k) => {
        const ss = snapshot.bySkill[k]!;
        return [
          k,
          this.formatNumber(ss.calls),
          this.formatNumber(ss.errors),
          this.formatNumber(ss.avgDurationMs),
        ];
      });
      const skillWidths = skillHeader.map((h, i) =>
        Math.max(h.length, ...skillRows.map((r) => r[i]!.length)),
      );
      const formatSkillLine = (cols: string[]) =>
        cols
          .map((c, i) =>
            this.pad(c, skillWidths[i]!, i === 0 ? "left" : "right"),
          )
          .join("  ");
      lines.push(formatSkillLine(skillHeader));
      lines.push(
        skillWidths
          .map((w, i) => (i === 0 ? "".padEnd(w, "-") : "".padStart(w, "-")))
          .join("  "),
      );
      for (const r of skillRows) {
        lines.push(formatSkillLine(r));
      }
    }

    return lines.join("\n");
  }
}

export const fullscreenTableFormatter = new FullscreenTableFormatter();
