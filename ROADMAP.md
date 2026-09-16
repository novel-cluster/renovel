# ReNovel ROADMAP

ReNovel 1.0（[PRD §60 Definition of Done](./PRD.md)）に向けた開発ロードマップ。
設計の詳細は [`docs/`](./docs/README.md) を参照（全体: [architecture](./docs/design/overview/architecture.md) / [frontend](./docs/design/overview/frontend.md) / [infrastructure](./docs/design/overview/infrastructure.md) / [data-model](./docs/design/foundation/data-model.md) / [routing](./docs/design/foundation/routing.md) / [auth](./docs/design/foundation/auth.md)、ドメイン別: [text-notation](./docs/design/domains/text-notation.md) / [writing-revision](./docs/design/domains/writing-revision.md) / [reading](./docs/design/domains/reading.md) / [social-notification](./docs/design/domains/social-notification.md) / [discovery](./docs/design/domains/discovery.md) / [analytics](./docs/design/domains/analytics.md) / [collaboration-fork](./docs/design/domains/collaboration-fork.md) / [moderation](./docs/design/domains/moderation.md)、他: [glossary](./docs/design/reference/glossary.md) / [testing](./docs/design/reference/testing.md)）。

- **現状:** scaffold 段階。`app/src/index.ts` は Hono の Hello スタブ。Docker ファイルは空。
- **設計:** Phase 1–9 の詳細設計は [`docs/design/`](./docs/README.md) に整備済み（データモデル・認証認可・各ドメイン仕様）。各フェーズ冒頭の「設計」行から該当ドキュメントへ辿れる。実装前に該当ドキュメントを読むこと。
- **原則:** 各フェーズは Reader First / Text First を優先し、縦に薄く（1 機能を UI〜DB まで）通してから広げる。
- フェーズ番号は依存順。番号が小さいものが土台。

凡例: `[ ]` 未着手 / `[~]` 進行中 / `[x]` 完了

---

## Phase 0 — Foundation（基盤）✅

土台。ここが無いと他が始まらない。

- [x] レイヤ骨格を作る（`presentation / application / domain / infrastructure / shared`、[architecture §3](./docs/design/overview/architecture.md)）
- [x] Hono ルーティング / Controller / Middleware の雛形（`presentation/app.ts`, `routes/`, `error.middleware.ts`）
- [x] `hono/jsx` レイアウト・SSR 基盤、Kiwa UI 取り込み、Tailwind v4 ビルド（`views/layout.tsx`, `bun run css`）
- [x] Drizzle 導入 + PostgreSQL 接続 + migration 運用（`drizzle.config.ts`, `db:generate`/`db:migrate`）
- [x] Repository interface(domain) / Drizzle 実装(infra) のパターン確立（health スライス）
- [x] エラー/DTO/共通型の shared 基盤（`shared/errors/app-error.ts`）
- [x] Docker: `Dockerfile.dev` / `docker-compose.dev.yml`（web + postgres）で開発環境が立つ
- [x] Lint / format / test ツールの導入（Biome + `bun test`）

**完了条件:** ✅ DB につながる Hono アプリが SSR ページを返し、Service→Repository→Postgres の縦串（`/health`）が通る。
（検証: `/` が SSR + Tailwind で 200、`/health` は DB down 時 503 / up 時 `{"status":"ok"}` 200、`bun test` 2/2、`biome check` clean。）

---

## Phase 1 — Identity（認証・ユーザー）

全機能の前提。読者=作者の統合アカウント（PRD §6）。

**設計:** [auth.md](./docs/design/foundation/auth.md)（認証・認可・権限マトリクス） / [data-model.md](./docs/design/foundation/data-model.md)（users/sessions/oauth_accounts） / [routing.md](./docs/design/foundation/routing.md)（`/@{handle}`・`/studio`）

- [x] User / Handle / Profile ドメイン（`/@{handle}`）
- [~] Session 認証 + OAuth（認証コンテキストを `c.get("user")` に載せる）— **Session + パスワード(Argon2id)完了**。OAuth は未着手（Provider 未決, PRD §52）
- [x] 認可の基盤（`requireAuth` / セッション middleware / 401·403·404 マッピング）。Role×Visibility の Policy 本体は作品が出る Phase 2/7 で追加
- [x] プロフィール表示・編集（Display Name / Bio / External Links 表示 / 編集）— Icon アップロードと handle 変更は後続

**完了条件:** ログインしてプロフィールを持てる。以降の全機能が「誰が」を判定できる。
→ **達成(パスワード認証で)**: signup→session cookie→`/@handle`→プロフィール編集→logout→login を実 DB で E2E 確認済み。OAuth と Icon アップロードは後続 PR。

---

## Phase 2 — Novel & Writing（作品・執筆）★コア

ReNovel の中心。ここまでで「書いて公開できる」。

**設計:** [data-model.md](./docs/design/foundation/data-model.md)（novels/chapters/episodes/episode_revisions） / [writing-revision.md](./docs/design/domains/writing-revision.md)（Episode 状態機械・Revision・Autosave・予約公開） / [text-notation.md](./docs/design/domains/text-notation.md)（ルビ・傍点・XSS 安全変換） / [routing.md](./docs/design/foundation/routing.md)（slug/URL） / [frontend §5](./docs/design/overview/frontend.md)（Editor island）

- [x] Novel ドメイン: `Novel→(任意)Chapter→Episode`、メタデータ（表紙画像なし、PRD §7）— Chapter はスキーマのみ（章立て UI は後続）
- [x] Visibility(Public/Unlisted/Private) と Publication Status(Ongoing/Completed/Hiatus) を直交で実装（PRD §8–9）
- [x] Episode + **Revision**（`EpisodeRevision[]`、上書きしない、PRD §12）— 手動保存/公開で追記。復元 UI は後続
- [~] Editor（island）: 手動保存 / 文字数 / サーバ Preview 完了。**自動保存 island・ライブプレビューは後続 PR**
- [x] 記法変換: ルビ `｜文章《ルビ》` / 傍点 `《《文章》》`（サーバ変換 + XSS 対策、`renderNovelText`、22 ケーステスト）
- [~] Draft / Publish 完了。**Scheduled Publish はスキーマのみ**（worker 実行は後続）
- [x] Content Warning（PRD §10）— 設定/表示

**完了条件:** 作者が Novel を作り、記法付き Episode を執筆・Revision 管理し、公開できる。
→ **達成**: 実 DB で 作成→執筆(記法)→保存(Revision)→公開→`/@{handle}/{slug}` 閲覧 を E2E 確認。private/draft は非権限者に 404。自動保存/予約公開/章立て/復元 UI は後続。

---

## Phase 3 — Reading（読書体験）★コア

Reader First の本丸。書いたものを快適に読める。

**設計:** [reading.md](./docs/design/domains/reading.md)（Reading Progress・Library・Reader Settings 永続化・プライバシー） / [frontend §4](./docs/design/overview/frontend.md)（Reader Settings UI・CSS 変数） / [text-notation.md](./docs/design/domains/text-notation.md)（本文レンダリング） / [data-model.md](./docs/design/foundation/data-model.md)（reading_progress/library_entries）

- [x] 作品ページ / Episode 本文の SSR（不要 JS を配らない、PRD §55）— Phase 2 で公開ページ、Phase 3 で読書機能追加
- [~] Reader Settings（文字サイズ / テーマ Light/Dark/Sepia / **縦横**）を CSS で即時反映（島, [frontend §4.1](./docs/design/overview/frontend.md)）— 行間/幅/フォント切替は後続
- [x] Reading Progress（最後の Episode・「続きから読む」、PRD §18）— スクロール位置の精密記録は後続(analytics 連携)
- [x] Library（Reading / Read Later / Completed / Favorite、PRD §19）
- [~] SEO/メタ（Public のみ index、OGP/canonical、PRD §56）— Structured Data(JSON-LD) は後続

**完了条件:** 発見→作品ページ→Episode 1→続きを読む→Library の読者フローが通る（成功の定義 Reader、PRD §62）。
→ **達成**: 実 DB で エピソード閲覧→進捗記録→「続きから読む」→本棚追加/一覧、Reader Settings 島(文字/テーマ/縦書き)、公開=index・非公開/下書き=noindex を E2E 確認。

---

## Phase 4 — Social & Notification（反応・通知）

作品に反応が集まる。

**設計:** [social-notification.md](./docs/design/domains/social-notification.md)（Like/Star/Review/Comment/Follow・通知配信） / [data-model.md](./docs/design/foundation/data-model.md)（likes/stars/reviews/comments/follows/notifications）

- [x] Like（Episode 単位、1 user 1 Episode、取消可、PRD §20.1）
- [x] Star（Novel 単位 1–3、PRD §20.2）/ Review（Stars+Title+Body、PRD §20.3）
- [x] Comment（Episode 単位、読了後、PRD §20.4）— reading_progress による読了ゲート
- [x] Follow（User / Novel、PRD §21）
- [x] Notification（In-App、like/star/review/comment/user_follow/novel_follow/novel_update、PRD §22）

**完了条件:** 読者が評価・感想・フォローでき、作者に In-App 通知が届く。
→ **達成**: 実 DB で いいね/コメント(読了ゲート)/星(1-3・平均キャッシュ)/レビュー/作品・ユーザーフォロー(カウンタ)、公開時の novel_update ファンアウト、通知一覧を E2E 確認。既読バッジ数値は後続。

---

## Phase 5 — Discovery（発見）

読者が作品にたどり着く導線。

**設計:** [discovery.md](./docs/design/domains/discovery.md)（日本語全文検索・Filter/Sort・ランキング・レコメンド・Home） / [data-model.md](./docs/design/foundation/data-model.md)（tags/novel_tags・集計方針）

- [x] Search（Title/Catchphrase/Description/User/Tag、PRD §23）+ Filter（PRD §24）+ Sort（PRD §25）— ILIKE 実装（PGroonga は後続、SearchRepository で隠蔽）
- [x] Ranking（Daily/Weekly/Monthly/New/Completed、時間減衰スコア、PRD §26）— カウンタ由来スコア。analytics 由来は Phase 6 後に差替
- [x] Recommendation（Rule Based＝人気、PRD §27）
- [x] Home（ログイン/ゲスト出し分け、PRD §28）
- [x] N+1 回避（Query 層で取得、PRD §55）

**完了条件:** ゲスト/ログインの Home・検索・ランキング・おすすめから作品に到達できる。
→ **達成**: 実 DB で 検索(タイトル/作者/タグ)・フィルタ/ソート・ランキング(日週月/新着/完結)・タグ編集・Home を E2E 確認。非公開作品は検索/ランキング/Home に出ない。日本語全文検索の PGroonga 化と analytics 由来ランキングは後続。

---

## Phase 6 — Analytics（作者分析）★差別化

「作者向け Google Analytics」（PRD §29）。他サイトとの主要な差別化。

**設計:** [analytics.md](./docs/design/domains/analytics.md)（イベント収集・集計パイプライン・各ダッシュボード算出・プライバシー） / [architecture §7](./docs/design/overview/architecture.md)（分離方針） / [data-model.md](./docs/design/foundation/data-model.md)（analytics スキーマ）

- [x] Analytics イベント収集基盤（transactional と分離＝`analytics` スキーマ、fire-and-forget）
- [~] Event Store → 集計（現状はイベントから直接クエリ。`analytics_hourly/daily` バッチ集計は後続）
- [x] Overview（PV/Unique + Like/Star/Comment/Review/Follow、期間切替 7/30日、PRD §30）
- [x] Episode Analytics（Views/Unique/読了、PRD §31）— 平均読書時間/スクロールは後続
- [x] **Reading Funnel**（Episode 別の閲覧・読了率・第1話比、PRD §32）
- [~] Acquisition（UTM を収集。ダッシュボード表示は後続、PRD §33）
- [ ] Realtime（現在の読者数、PRD §34）— 後続
- [ ] Retention（翌日/7日/30日、PRD §35）— 後続
- [x] プライバシー: 集計のみ・個人行動履歴を出さない（PRD §58）

**完了条件:** 作者が作成→公開→読者獲得→分析→改善のサイクルを回せる（成功の定義 Author、PRD §62）。
→ **達成(コア)**: 実 DB で 閲覧イベント収集(分離スキーマ)→PV/unique/読了ファネル ダッシュボードを Owner 限定で E2E 確認。集計バッチ/Realtime/Retention/Acquisition 画面は後続。

---

## Phase 7 — Collaboration & Fork（共同制作・派生）★差別化

作品モデルにネイティブ組み込み（PRD §5）。

**設計:** [collaboration-fork.md](./docs/design/domains/collaboration-fork.md)（招待・Role・Fork 系譜・帰属強制・Change Proposal） / [auth.md](./docs/design/foundation/auth.md)（Role 権限マトリクス） / [data-model.md](./docs/design/foundation/data-model.md)（collaborators/forks/fork_requests/change_proposals）

- [x] Collaborator 招待 + Role（Owner/Admin/Writer/Editor/Viewer、PRD §13）
- [x] Role ごとの権限をサーバ側で強制（権限マトリクス・Policy、PRD §59）
- [x] 共同編集（collaborator が Revision を刻む）
- [x] Fork（派生作品・エピソード複製、原作帰属表示は削除不可、PRD §14）
- [~] Fork Policy（Disabled / Allowed 実装、Approval Required は承認フロー後続、PRD §15）
- [ ] （優先度低）Change Proposal = PR 型（Accept/Reject/Comment、PRD §16）— 後続

**完了条件:** 作成→招待→共同執筆→Revision 確認→公開、および Fork ができる（成功の定義 Collaboration、PRD §62）。
→ **達成**: 実 DB で 招待→承諾→writer で執筆(Revision)・settings は 403(ロール強制)、Fork→エピソード複製+「Forked from」帰属 を E2E 確認。Change Proposal と承認制 Fork は後続。

---

## Phase 8 — Moderation（管理・モデレーション）

健全な運用の担保。

**設計:** [moderation.md](./docs/design/domains/moderation.md)（Report/Block/Mute・Admin 対処・状態遷移） / [auth.md](./docs/design/foundation/auth.md)（Admin 権限） / [data-model.md](./docs/design/foundation/data-model.md)（reports/blocks/mutes/user_status）

- [x] User 機能: Report(User/Novel/Episode/Comment/Review) / Block / Mute（PRD §37）
- [x] Admin 機能: Report 管理 / Hide Novel・Episode / Delete Comment・Review / Suspend / Ban（PRD §37）

**完了条件:** 通報〜対処のモデレーション運用が回る。
→ **達成**: 実 DB で 通報→Admin キュー→作品Hide(→404)/凍結/BAN(→セッション無効化) を E2E 確認。`is_admin` ガードで /admin は非管理者に 404。ブロック/ミュートの表示反映の細部は後続。

---

## Phase 9 — Hardening & Launch（品質・本番化）

1.0 リリース。

**設計:** [auth.md](./docs/design/foundation/auth.md)（CSRF/認可）・[testing.md](./docs/design/reference/testing.md)（テスト戦略・高リスク領域）・[infrastructure.md](./docs/design/overview/infrastructure.md)（本番 Compose・Cloudflare Tunnel）

- [x] セキュリティ総点検（CSRF/XSS/SQLi/Rate Limit/CSP/Secure Cookie/認可、PRD §59）— [launch.md §2](./docs/design/overview/launch.md)
- [x] パフォーマンス（SSR 速度・不要 JS 削減・N+1・非ブロッキング分析、PRD §55）
- [~] アクセシビリティ（Semantic HTML/label/Reader Settings、PRD §57）— aria/コントラスト実機点検は後続
- [x] Docker: `Dockerfile.prod` + `docker-compose.prod.yml` + `cloudflared` 本番構成
- [x] Cloudflare Tunnel 公開（ingress ポートを開けない、PRD §54）
- [~] バックアップ/監視/ログ/migration デプロイ手順 — 手順は [launch.md §1](./docs/design/overview/launch.md)、監視/ログ集約は後続

**完了条件:** PRD §60 の全項目が Production で利用可能。
→ **達成(コア)**: CSP + Rate Limiting + 本番 Compose(no-ingress + Cloudflare Tunnel + migrate one-shot) を実装・検証。監視/ログ集約、外部セキュリティレビュー、A11y 実機点検は後続。

---

## スケール余地（1.0 では未着手・必要時に追加）

- `redis` / `worker` / `analytics-worker` を Compose に追加（PRD §54、[infrastructure §3.2](./docs/design/overview/infrastructure.md)）
- Analytics を独立サービスへ切り出し（[architecture §10](./docs/design/overview/architecture.md)）

## 1.x 以降（Future, PRD §61）

Creator Monetization / 広告収益還元 / Payout / Paragraph Comments / 高度な Change Proposal / リアルタイム同時編集 / Custom Library Collections / 高度な推薦 / Web Push / Email / Public API / ActivityPub / Native App。
