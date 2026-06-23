import type { DashboardPanel } from "../dashboard.types";
import type { DashboardData, ErrorRow } from "../dashboard.types";
import { escapeHtml } from "../dashboard-helpers";
import { ERRORS_PANEL_TEMPLATE } from "../templates/panels/errors";

type ErrorsPanelData = {
  hasData: boolean;
  content: string;
  emptyMessage: string;
};

function buildErrorTable(errors: ErrorRow[]): string {
  const rows = errors
    .map(
      (e) =>
        `<tr>
  <td class="whitespace-nowrap px-4 py-2 text-sm text-gray-900">${escapeHtml(e.tool)}</td>
  <td class="px-4 py-2 text-sm text-gray-700">${escapeHtml(e.message)}</td>
  <td class="px-4 py-2 text-sm text-gray-700">${escapeHtml(e.sessions.join(", "))}</td>
</tr>`,
    )
    .join("\n");

  return `<div class="overflow-x-auto">
  <table class="w-full text-left text-sm">
    <thead>
      <tr class="border-b border-gray-200">
        <th class="px-4 py-2 font-medium text-gray-600">Tool</th>
        <th class="px-4 py-2 font-medium text-gray-600">Message</th>
        <th class="px-4 py-2 font-medium text-gray-600">Sessions</th>
      </tr>
    </thead>
    <tbody class="divide-y divide-gray-100">
${rows}
    </tbody>
  </table>
</div>`;
}

export const errorsPanel: DashboardPanel<ErrorsPanelData> = {
  id: "errors",
  title: "Errors",
  gridClass: "md:col-span-2",

  dataProvider: (data: DashboardData): ErrorsPanelData => {
    if (data.errors.length === 0) {
      return {
        hasData: false,
        content: "",
        emptyMessage: "No errors detected",
      };
    }

    return {
      hasData: true,
      content: buildErrorTable(data.errors),
      emptyMessage: "",
    };
  },

  templateSource: ERRORS_PANEL_TEMPLATE,
};
