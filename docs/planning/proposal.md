# ReNovel 企画書 / Product Proposal

> 本書は PRD（[`PRD.md`](../../PRD.md)）を「企画書」として読み下し、意思決定に必要な背景・狙い・スコープを一枚にまとめたもの。詳細仕様は PRD を正典とする。

## 1. 一行で言うと

**「書き、公開し、読まれ方を知り、他者と作品を作れる」Web 小説プラットフォーム。**
読者にはシンプルな投稿サイトに見え、作者には強力な制作・分析ツールとして機能する。

## 2. 背景と課題

既存の Web 小説投稿サイトは「投稿・閲覧・評価・ランキング」までは提供するが、次の点が弱い。

- **執筆体験** — 記法やツール操作が前に出て、文章に集中しづらい。
- **分析** — 累積 PV 程度しか見えず、「どの話で離脱したか」「どこから来たか」が分からない。
- **共同制作** — 複数作者・派生作品が後付けで、権限や帰属が曖昧。

ReNovel はこの 3 点を一次的な強みとして設計する。

## 3. ターゲット

| 区分 | 対象 | 提供価値 |
|---|---|---|
| Primary | Web 小説を日常的に読む読者 | 発見しやすさ・本文集中・続きからすぐ読める |
| Secondary | Web 小説作者 | ストレスのない執筆、自動保存/Revision、読者行動分析 |
| Secondary | 共同制作・二次創作の作者 | ネイティブな共同編集・Fork・変更提案 |

読者アカウントと作者アカウントは分離しない。全ユーザーが読む/書く/フォローする/評価する/共同制作する（PRD §6）。

## 4. 設計原則（PRD §5）

1. **Reader First** — 読書画面を何より優先し、作者機能で複雑化させない。
2. **Text First** — 表紙画像を扱わず、タイトル・キャッチコピー・文章で勝負する。
3. **Writing Should Be Invisible** — 記法・ツールを意識させない。
4. **Data Helps Writers** — PV でなく読了率・離脱・読書時間・遷移を返す。
5. **Collaboration Is Native** — 共同制作を作品モデルそのものに組み込む。

これらは実装時のトレードオフ判断基準そのもの。迷ったら Reader First と Text First に寄せる。

## 5. 差別化の核（4 本柱）

1. **高品質な執筆 UX** — プレーンテキスト + 最小限の記法（ルビ `｜文章《ルビ》` / 傍点 `《《文章》》`）、自動保存、Revision と復元。
2. **作者向け Google Analytics** — Overview / Episode 分析 / Reading Funnel（離脱可視化）/ Acquisition（流入元・UTM）/ Realtime / Retention。
3. **ネイティブ共同制作** — Owner/Admin/Writer/Editor/Viewer の 5 ロールを作品モデルに内蔵。
4. **Fork（派生作品）** — GitHub の Fork に近く、原作への帰属表示は削除不可。将来的に変更提案（Pull Request 型）。

## 6. スコープ

### 6.1 In Scope（1.0 Definition of Done, PRD §60）
- **Reader:** Novel/Episode 閲覧、Reader Settings、Reading Progress、Library、Search、Ranking、Recommendation、Follow
- **Author:** Novel/Chapter/Episode 管理、Editor（Ruby/Emphasis/Autosave/Draft/Publish/Scheduled Publish/Revision History）
- **Collaboration:** Collaborator Invite、Role 管理、共同編集、Fork、Fork Policy
- **Social:** Like（Episode 単位）、Star（Novel 単位 1〜3）、Review、Comment、User/Novel Follow、Notification（初期は In-App）
- **Analytics:** Overview / Episode / Funnel / Acquisition / Realtime / Retention
- **Administration:** Report、Block、Mute、Moderation、Suspend/Ban

### 6.2 Out of Scope / Non-Goals（PRD §3, §61）
初期リリースでは扱わない: 電子書籍販売・有料エピソード・サブスク・広告収益還元・投げ銭・ネイティブアプリ・リアルタイム同時編集・AI 小説生成・音声読み上げ。収益化・Web Push・Email・Public API・ActivityPub は 1.x 以降。

## 7. コアなプロダクト判断

| 判断 | 内容 | 理由 |
|---|---|---|
| 表紙画像を持たない | Novel に cover 画像フィールドなし | Text First。画像優劣ではなく文章で発見される場を作る |
| Markdown を採用しない | プレーンテキスト + 独自ルビ/傍点記法 | 一般作者に馴染む縦書き文化・記法。Writing Should Be Invisible |
| Draft は状態でなく可視性 | Publication Status と Visibility を直交させる | 「未完 but 公開」「完結 but 下書き」を両立 |
| 分析は常に集計値 | 個人単位の読書履歴は作者に見せない | 強力な分析とプライバシーの両立（PRD §58） |
| SPA に依存しない | Hono + SSR 中心、Islands のみ hono/jsx/dom | 読書画面に不要な JS を配らない（Performance / Reader First） |

## 8. 成功の定義（PRD §62）

- **Reader:** 発見 → 作品ページ → Episode 1 → 続きを読む → Library/Follow が自然に流れる。
- **Author:** 作成 → 執筆 → 公開 → 読者獲得 → Analytics 確認 → 改善 のサイクルが ReNovel 内で完結する。
- **Collaboration:** 作成 → 招待 → 共同執筆 → Revision 確認 → 公開 ができる。

## 9. 技術方針サマリ（PRD §39–52）

Bun + Hono を中心に、SSR は `hono/jsx`、インタラクティブな島だけ `hono/jsx/dom`。DB は PostgreSQL + Drizzle。アーキテクチャは **DDD + MVC + Service Layer**。デプロイは Docker Compose + Cloudflare Tunnel（自宅/自前サーバ、直接ポート開放しない）。詳細は [architecture.md](../design/architecture.md) / [frontend.md](../design/frontend.md) / [infrastructure.md](../design/infrastructure.md)。

## 10. 想定リスク

| リスク | 対応方針 |
|---|---|
| 分析イベントが読書操作をブロック | 送信は非同期・fire-and-forget、集計はバッチ（[architecture.md](../design/architecture.md) 参照） |
| 共同制作/Private の権限漏れ | UI でなくサーバ側で必ず Authorization（PRD §59） |
| N+1 による作品一覧/検索の遅延 | Read 用 Query 層を分離、必要な JOIN を明示 |
| Fork/派生の帰属欠落・炎上 | 帰属表示は削除不可を仕様レベルで担保 |
| 自前ホスト単一障害点 | Compose 構成、後から redis/worker/analytics-worker を追加できる設計 |
