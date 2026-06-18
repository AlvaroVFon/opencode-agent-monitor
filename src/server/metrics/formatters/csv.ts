import type { MetricsSnapshot } from "../../../shared/metrics.types";

function escapeCsv(value: string | number): string {
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function formatCsv(snap: MetricsSnapshot): string {
  const lines: string[] = [];

  lines.push("section,key,metric,value");

  const t = snap.totals;
  lines.push(`totals,,llmCalls,${t.llmCalls}`);
  lines.push(`totals,,llmErrors,${t.llmErrors}`);
  lines.push(`totals,,toolCalls,${t.toolCalls}`);
  lines.push(`totals,,toolErrors,${t.toolErrors}`);
  lines.push(`totals,,cost,${t.cost}`);
  lines.push(`totals,,sessionsCreated,${t.sessionsCreated}`);
  lines.push(`totals,,sessionErrors,${t.sessionErrors}`);

  for (const [agent, agg] of Object.entries(snap.byAgent)) {
    lines.push(`byAgent,${escapeCsv(agent)},llmCalls,${agg.llmCalls}`);
    lines.push(`byAgent,${escapeCsv(agent)},cost,${agg.cost}`);
  }

  for (const [tool, stats] of Object.entries(snap.byTool)) {
    lines.push(`byTool,${escapeCsv(tool)},calls,${stats.calls}`);
    lines.push(`byTool,${escapeCsv(tool)},errors,${stats.errors}`);
    lines.push(`byTool,${escapeCsv(tool)},durationMs,${stats.durationMs}`);
  }

  for (const err of snap.errors) {
    lines.push(
      `error,${escapeCsv(err.sessionID)},${escapeCsv(err.type)},${escapeCsv(err.message)},${err.timestamp}`,
    );
  }

  return lines.join("\n");
}
