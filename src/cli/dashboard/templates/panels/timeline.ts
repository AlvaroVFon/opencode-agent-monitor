/**
 * Timeline panel template.
 *
 * Renders chronological per-session groups when there is data,
 * or a "No timeline data" message when the timeline array is empty.
 * Session IDs are pre-escaped by the data provider.
 */
export const TIMELINE_PANEL_TEMPLATE = `{{#if data.hasData}}
{{{data.content}}}
{{else}}
<p class="text-sm text-gray-400">{{data.emptyMessage}}</p>
{{/if}}`;
