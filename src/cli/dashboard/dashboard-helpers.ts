/**
 * Shared helpers for dashboard HTML rendering.
 *
 * These functions are used by the engine's render method and by
 * panel data providers to build pre-escaped HTML content.
 */

/** Format a number with locale-aware thousands separators. */
export function fmt(n: number): string {
  return n.toLocaleString("en-US");
}

/** Format a cost value as a dollar string. */
export function fmtCost(n: number): string {
  return `$${n.toFixed(4)}`;
}

/** HTML-escape a user-supplied string for safe inclusion in HTML body context. */
export function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
