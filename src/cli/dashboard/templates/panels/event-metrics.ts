/**
 * Event Metrics panel template.
 *
 * Renders aggregated event data (per-type counts, average durations,
 * top-5 slowest) when there is data, or a "No events recorded"
 * message when the events array is empty.
 */
export const EVENT_METRICS_PANEL_TEMPLATE = `{{#if data.hasData}}
<div class="space-y-4">
  {{#if data.typeCounts}}
  <div>
    <h3 class="mb-2 text-sm font-semibold text-gray-600">Events by Type</h3>
    <div class="overflow-x-auto">
      <table class="w-full text-left text-sm">
        <thead>
          <tr class="border-b border-gray-200">
            <th class="px-4 py-2 font-medium text-gray-600">Type</th>
            <th class="px-4 py-2 font-medium text-gray-600">Count</th>
            <th class="px-4 py-2 font-medium text-gray-600">Avg Duration</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100">
        {{#each data.typeCounts}}
          <tr>
            <td class="px-4 py-2 text-sm text-gray-900">{{type}}</td>
            <td class="px-4 py-2 text-sm text-gray-700">{{count}}</td>
            <td class="px-4 py-2 text-sm text-gray-700">{{avgDurationMs}}ms</td>
          </tr>
        {{/each}}
        </tbody>
      </table>
    </div>
  </div>
  {{/if}}

  {{#if data.top5Slowest}}
  <div>
    <h3 class="mb-2 text-sm font-semibold text-gray-600">Top 5 Slowest Events</h3>
    <ol class="list-inside list-decimal space-y-1 text-sm text-gray-700">
    {{#each data.top5Slowest}}
      <li>{{type}} — {{durationMs}}ms</li>
    {{/each}}
    </ol>
  </div>
  {{/if}}
</div>
{{else}}
{{> "empty-state" message=data.emptyMessage}}
{{/if}}`;
