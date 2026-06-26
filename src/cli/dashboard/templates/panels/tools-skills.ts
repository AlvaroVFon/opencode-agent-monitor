/**
 * Tools & Skills panel template.
 *
 * Renders a doughnut chart canvas (pre-escaped HTML) and a table of
 * tool/skill usage stats when there is data, or a "No tool or skill data"
 * message when both arrays are empty.
 */
export const TOOLS_SKILLS_PANEL_TEMPLATE = `{{#if data.hasData}}
{{{data.chartHtml}}}
{{{data.tableHtml}}}
{{else}}
<p class="text-sm text-gray-400">{{data.emptyMessage}}</p>
{{/if}}`;
