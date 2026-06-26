/**
 * Tokens panel template.
 *
 * Renders a canvas for the stacked bar token chart when there is data,
 * or a "No token data" message when the token array is empty.
 */
export const TOKENS_PANEL_TEMPLATE = `{{#if data.hasData}}
{{{data.content}}}
{{else}}
<p class="text-sm text-gray-400">{{data.emptyMessage}}</p>
{{/if}}`;
