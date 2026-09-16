import { renderNovelText } from '@/shared/text-notation'

/**
 * Renders an Episode body to paragraph HTML. `renderNovelText` handles ruby /
 * emphasis + escaping per line (text-notation.md); this wrapper owns the
 * line-break → `<br>` / blank-line → paragraph policy (§9).
 */
export function renderNovelBody(body: string): string {
  return body
    .split(/\n{2,}/)
    .map((para) => `<p>${para.split('\n').map(renderNovelText).join('<br />')}</p>`)
    .join('')
}
