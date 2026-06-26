import type { DashboardPanel } from "../dashboard.types";
import type { DashboardData } from "../dashboard.types";
import { escapeHtml, fmt, fmtCost } from "../dashboard-helpers";
import { TOOLS_SKILLS_PANEL_TEMPLATE } from "../templates/panels/tools-skills";

type ToolSkillRow = {
  name: string;
  calls: number;
  errors: number;
  durationMs: number;
  cost?: number;
};

type ToolsSkillsPanelData = {
  hasData: boolean;
  chartHtml: string;
  tableHtml: string;
  emptyMessage: string;
};

/**
 * Build an HTML table row for a tool or skill entry.
 * All user-supplied values (name) are HTML-escaped.
 */
function buildTableRow(r: ToolSkillRow): string {
  return `<tr>
  <td class="whitespace-nowrap px-4 py-2 text-sm text-gray-900">${escapeHtml(r.name)}</td>
  <td class="px-4 py-2 text-sm text-gray-700">${fmt(r.calls)}</td>
  <td class="px-4 py-2 text-sm text-gray-700">${fmt(r.errors)}</td>
  <td class="px-4 py-2 text-sm text-gray-700">${fmt(r.durationMs)}ms</td>
  <td class="px-4 py-2 text-sm text-gray-700">${r.cost != null ? fmtCost(r.cost) : "—"}</td>
</tr>`;
}

export const toolsSkillsPanel: DashboardPanel<ToolsSkillsPanelData> = {
  id: "tools-skills",
  title: "Tools & Skills",
  gridClass: "md:col-span-2",

  dataProvider: (data: DashboardData): ToolsSkillsPanelData => {
    const { tools, skills } = data;
    const hasData = tools.length > 0 || skills.length > 0;

    if (!hasData) {
      return {
        hasData: false,
        chartHtml: "",
        tableHtml: "",
        emptyMessage: "No tool or skill data",
      };
    }

    const allRows = [...tools, ...skills];
    const rowsHtml = allRows.map(buildTableRow).join("\n");

    const chartHtml = `<div class="mb-6" style="max-width:300px">
  <canvas id="toolsChart" height="300"></canvas>
</div>`;

    const tableHtml = `<div class="overflow-x-auto">
  <table class="w-full text-left text-sm">
    <thead>
      <tr class="border-b border-gray-200">
        <th class="px-4 py-2 font-medium text-gray-600">Name</th>
        <th class="px-4 py-2 font-medium text-gray-600">Calls</th>
        <th class="px-4 py-2 font-medium text-gray-600">Errors</th>
        <th class="px-4 py-2 font-medium text-gray-600">Duration</th>
        <th class="px-4 py-2 font-medium text-gray-600">Cost</th>
      </tr>
    </thead>
    <tbody class="divide-y divide-gray-100">
${rowsHtml}
    </tbody>
  </table>
</div>`;

    return {
      hasData: true,
      chartHtml,
      tableHtml,
      emptyMessage: "",
    };
  },

  templateSource: TOOLS_SKILLS_PANEL_TEMPLATE,
};
