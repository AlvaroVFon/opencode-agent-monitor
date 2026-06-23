/**
 * Empty state card with a primary message and an optional description.
 * The description is rendered only when provided (Handlebars {{#if}}).
 */
export const EMPTY_STATE_TEMPLATE = `<div class="rounded-lg bg-white p-12 text-center shadow">
  <p class="text-lg text-gray-500">{{message}}</p>
  {{#if description}}<p class="mt-2 text-sm text-gray-400">{{description}}</p>{{/if}}
</div>`;
