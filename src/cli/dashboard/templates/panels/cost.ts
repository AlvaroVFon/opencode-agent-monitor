/**
 * Cost panel template.
 *
 * Renders a canvas for the cost bar chart when there is data,
 * or a "No cost data" message when the cost array is empty.
 * The content is pre-escaped by the data provider.
 */
export const COST_PANEL_TEMPLATE = `{{#if data.hasData}}
{{{data.content}}}
{{else}}
<p class="text-sm text-gray-400">{{data.emptyMessage}}</p>
{{/if}}`;
