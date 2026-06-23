/**
 * Single card wrapper with a title heading and raw HTML content section.
 * Content is injected as raw HTML (triple-stash) to support chart canvases,
 * tables, and other block elements.
 */
export const CARD_TEMPLATE = `<div class="rounded-lg bg-white p-6 shadow">
  <h2 class="mb-4 text-xl font-semibold text-gray-800">{{title}}</h2>
  {{{content}}}
</div>`;
