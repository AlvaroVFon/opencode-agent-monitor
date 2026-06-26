/**
 * Errors panel template.
 *
 * Renders an error table with tool, message, and sessions columns
 * when there is data, or a "No errors detected" message when the
 * errors array is empty. All user-supplied values are pre-escaped
 * by the data provider.
 */
export const ERRORS_PANEL_TEMPLATE = `{{#if data.hasData}}
{{{data.content}}}
{{else}}
<p class="text-sm text-gray-400">{{data.emptyMessage}}</p>
{{/if}}`;
