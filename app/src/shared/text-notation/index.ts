import { escapeHtml } from './escape'

/**
 * Renders Episode body plain text into safe HTML, applying the ruby / emphasis
 * notations (text-notation.md). Full-width `｜《》` are the only triggers; the
 * output is already HTML-escaped and safe to inject as innerHTML.
 *
 * This module is deliberately dependency-free (no Hono/Drizzle) so the same
 * function is shared by SSR body rendering and the Editor preview island.
 */
export function renderNovelText(input: string): string {
  // [1] escape → [2] apply notation (order is a security invariant, §6.1).
  return new NotationParser(escapeHtml(input)).parse()
}

/** Kanji run for auto-ruby (text-notation.md §3.1). BMP only (Ext-B excluded). */
function isKanji(ch: string): boolean {
  const cp = ch.codePointAt(0) ?? 0
  return (
    (cp >= 0x4e00 && cp <= 0x9fff) || // CJK Unified 一-鿿
    (cp >= 0x3400 && cp <= 0x4dbf) || // CJK Ext-A 㐀-䶿
    cp === 0x3005 || // 々
    cp === 0x3006 || // 〆
    cp === 0x30f6 // ヶ
  )
}

/**
 * Single left-to-right scanner. Broken/unclosed notation silently falls back to
 * literal output — the parser never throws (text-notation.md §5.3).
 */
class NotationParser {
  private i = 0

  constructor(private readonly s: string) {}

  parse(): string {
    return this.run(false).html
  }

  /**
   * Renders from the current index. When `inEmphasis`, returns as soon as a
   * top-level `》》` is consumed (`closed: true`); ruby inside emphasis consumes
   * its own `《…》` so it does not trip the emphasis close (§5.2).
   */
  private run(inEmphasis: boolean): { html: string; closed: boolean } {
    const s = this.s
    let out = ''
    while (this.i < s.length) {
      const c = s[this.i]

      if (inEmphasis && c === '》' && s[this.i + 1] === '》') {
        this.i += 2
        return { html: out, closed: true }
      }

      if (c === '\\') {
        const next = s[this.i + 1]
        if (next === '《' || next === '》' || next === '｜' || next === '\\') {
          out += next
          this.i += 2
        } else {
          out += c
          this.i += 1
        }
        continue
      }

      if (c === '｜') {
        out += this.explicitRuby()
        continue
      }

      if (c === '《') {
        if (!inEmphasis && s[this.i + 1] === '《') {
          const em = this.emphasis()
          if (em !== null) {
            out += em
            continue
          }
        }
        out = this.singleKuten(out)
        continue
      }

      out += c
      this.i += 1
    }
    return { html: out, closed: false }
  }

  /** `《《…》》`. Rolls back to a single `《` if it never closes (§5.2 rule 3). */
  private emphasis(): string | null {
    const save = this.i
    this.i += 2
    const { html, closed } = this.run(true)
    if (closed) return `<em class="emphasis-dots">${html}</em>`
    this.i = save
    return null
  }

  /** `｜base《reading》`. On failure emits a literal `｜` and advances one char. */
  private explicitRuby(): string {
    const s = this.s
    const start = this.i
    let j = start + 1
    while (j < s.length && s[j] !== '《' && s[j] !== '｜' && s[j] !== '\n') j++
    if (s[j] === '《') {
      let k = j + 1
      while (k < s.length && s[k] !== '》') k++
      if (s[k] === '》') {
        const reading = s.slice(j + 1, k)
        if (reading.length > 0) {
          const base = s.slice(start + 1, j)
          this.i = k + 1
          return `<ruby>${base}<rt>${reading}</rt></ruby>`
        }
      }
    }
    this.i = start + 1
    return '｜'
  }

  /**
   * A lone `《` opens a ruby reading; the base is the kanji run already emitted
   * into `out` (auto-ruby, §3.1). Falls back to a literal `《` when there is no
   * closing `》`, an empty reading, or no preceding kanji.
   */
  private singleKuten(out: string): string {
    const s = this.s
    const open = this.i
    let k = open + 1
    while (k < s.length && s[k] !== '》') k++
    if (s[k] === '》') {
      const reading = s.slice(open + 1, k)
      if (reading.length > 0) {
        let b = out.length
        while (b > 0 && isKanji(out[b - 1])) b--
        const base = out.slice(b)
        if (base.length > 0) {
          this.i = k + 1
          return `${out.slice(0, b)}<ruby>${base}<rt>${reading}</rt></ruby>`
        }
      }
    }
    this.i = open + 1
    return `${out}《`
  }
}
