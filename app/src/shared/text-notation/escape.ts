/**
 * HTML-escape untrusted text (text-notation.md §6.1). This MUST run before any
 * notation replacement so the tokenizer only ever sees escaped text and the only
 * HTML it can emit is the fixed `<ruby>`/`<rt>`/`<em>` tags it generates itself.
 */
export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
