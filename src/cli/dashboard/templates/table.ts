/**
 * Scrollable table wrapper. Headers and rows are injected as raw HTML
 * so that callers can build table content with their own data transformations.
 */
export const TABLE_TEMPLATE = `<div class="overflow-x-auto">
  <table class="w-full text-left text-sm">
    <thead>
      <tr class="border-b border-gray-200">
        {{{headers}}}
      </tr>
    </thead>
    <tbody class="divide-y divide-gray-100">
      {{{rows}}}
    </tbody>
  </table>
</div>`;
