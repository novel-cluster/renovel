import { describe, expect, it } from 'bun:test'
import { renderNovelText } from './index'

/** Cases mirror text-notation.md §8 (the numbers match that table). */
const cases: [string, string, string][] = [
  ['1 explicit ruby', '｜今日《きょう》は晴れ', '<ruby>今日<rt>きょう</rt></ruby>は晴れ'],
  ['2 multi-char base', '｜東京都《とうきょうと》', '<ruby>東京都<rt>とうきょうと</rt></ruby>'],
  ['3 auto ruby', '今日《きょう》は良い天気だ', '<ruby>今日<rt>きょう</rt></ruby>は良い天気だ'],
  ['4 auto ruby stops at kana', '食べる林檎《りんご》', '食べる<ruby>林檎<rt>りんご</rt></ruby>'],
  ['5 auto ruby fails (kana before)', 'のむ《のむ》', 'のむ《のむ》'],
  ['6 emphasis', '《《重要》》な部分', '<em class="emphasis-dots">重要</em>な部分'],
  [
    '7 ruby inside emphasis',
    '《《｜今日《きょう》》》',
    '<em class="emphasis-dots"><ruby>今日<rt>きょう</rt></ruby></em>',
  ],
  ['8 escaped brackets', '価格は\\《100円\\》です', '価格は《100円》です'],
  ['9 escaped backslash', 'パス C:\\\\file と \\《注記\\》', 'パス C:\\file と 《注記》'],
  [
    '10 XSS script tag',
    '｜<script>alert(1)</script>《ルビ》',
    '<ruby>&lt;script&gt;alert(1)&lt;/script&gt;<rt>ルビ</rt></ruby>',
  ],
  [
    '11 XSS attribute escape',
    '｜文章《"><img src=x onerror=alert(1)>》',
    '<ruby>文章<rt>&quot;&gt;&lt;img src=x onerror=alert(1)&gt;</rt></ruby>',
  ],
  [
    '12 XSS inside emphasis',
    '《《<b>bold</b>》》',
    '<em class="emphasis-dots">&lt;b&gt;bold&lt;/b&gt;</em>',
  ],
  [
    '13 nested emphasis markers',
    '《《《《強調》》》》',
    '<em class="emphasis-dots">《《強調</em>》》',
  ],
  ['14 unclosed ruby', '今日《きょうのまま', '今日《きょうのまま'],
  ['15 unclosed emphasis', '《《強調のまま', '《《強調のまま'],
  ['16 lone close bracket', '終わり》です', '終わり》です'],
  ['17 empty reading', '｜文章《》', '｜文章《》'],
  ['18 half-width is literal', 'a|b<c>d', 'a|b&lt;c&gt;d'],
  [
    '20 mixed ruby + emphasis',
    '｜親《おや》は《《嘘つき》》だ',
    '<ruby>親<rt>おや</rt></ruby>は<em class="emphasis-dots">嘘つき</em>だ',
  ],
  [
    '21 consecutive notations',
    '｜本日《ほんじつ》は《《快晴》》なり',
    '<ruby>本日<rt>ほんじつ</rt></ruby>は<em class="emphasis-dots">快晴</em>なり',
  ],
  [
    '22 fullwidth quotes as boundary',
    '彼は「《ここに注目》」と言った',
    '彼は「《ここに注目》」と言った',
  ],
]

describe('renderNovelText', () => {
  for (const [name, input, expected] of cases) {
    it(name, () => {
      expect(renderNovelText(input)).toBe(expected)
    })
  }

  // §8 case 19: a `｜` whose base hits a newline fails, but the later `本文《ルビ》`
  // independently satisfies auto-ruby. The spec table shows the whole line
  // unchanged, which is inconsistent with auto-ruby (spec §9 flags newline
  // handling as unresolved). We follow the auto-ruby rules; documented deviation.
  it('19 newline in explicit base (documented deviation)', () => {
    expect(renderNovelText('｜文章\n本文《ルビ》')).toBe('｜文章\n<ruby>本文<rt>ルビ</rt></ruby>')
  })

  it('never throws and always escapes stray HTML', () => {
    expect(renderNovelText('<b>&"\'')).toBe('&lt;b&gt;&amp;&quot;&#39;')
  })
})
