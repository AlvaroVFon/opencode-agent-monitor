/**
 * Full HTML page shell with Handlebars placeholders for panels, styles, and scripts.
 * Styles and scripts are injected as raw HTML (triple-stash) to avoid Handlebars
 * conflicts with CSS curly braces and JavaScript syntax.
 */
export const LAYOUT_TEMPLATE = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{{title}}</title>
<script src="https://cdn.tailwindcss.com"></script>
{{#if styles}}<style>{{{styles}}}</style>{{/if}}
</head>
<body class="bg-gray-100 min-h-screen p-4 md:p-8">
<div class="mx-auto max-w-7xl">
  <h1 class="mb-8 text-3xl font-bold text-gray-900">{{title}}</h1>
  {{#if summary}}<p class="mb-6 text-sm text-gray-500">{{{summary}}}</p>{{/if}}
  {{{panels}}}
</div>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.7/dist/chart.umd.min.js"></script>
{{{scripts}}}
</body>
</html>`;
