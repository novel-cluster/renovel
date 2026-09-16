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

- [ ] User / Handle / Profile ドメイン（`/@{handle}`）
- [ ] Session 認証 + OAuth（Provider 決定、PRD §52）、認証コンテキストを `c.get("user")` に載せる
- [ ] 認可の基盤（サーバ側で必ずチェック、PRD §59）
- [ ] プロフィール表示・編集（Display Name / Icon / Bio / External Links）

**完了条件:** ログインしてプロフィールを持てる。以降の全機能が「誰が」を判定できる。

---

## Phase 2 — Novel & Writing（作品・執筆）★コア

ReNovel の中心。ここまでで「書いて公開できる」。

**設計:** [data-model.md](./docs/design/foundation/data-model.md)（novels/chapters/episodes/episode_revisions） / [writing-revision.md](./docs/design/domains/writing-revision.md)（Episode 状態機械・Revision・Autosave・予約公開） / [text-notation.md](./docs/design/domains/text-notation.md)（ルビ・傍点・XSS 安全変換） / [routing.md](./docs/design/foundation/routing.md)（slug/URL） / [frontend §5](./docs/design/overview/frontend.md)（Editor island）

- [ ] Novel ドメイン: `Novel→(任意)Chapter→Episode`、メタデータ（表紙画像なし、PRD §7）
- [ ] Visibility(Public/Unlisted/Private) と Publication Status(Ongoing/Completed/Hiatus) を直交で実装（PRD §8–9）
- [ ] Episode + **Revision**（`EpisodeRevision[]`、上書きしない・復元可、PRD §12）
- [ ] Editor（island）: プレーンテキスト、自動保存 / 手動保存 / 文字数 / Preview（PRD §11, [frontend §5](./docs/design/overview/frontend.md)）
- [ ] 記法変換: ルビ `｜文章《ルビ》` / 傍点 `《《文章》》`（サーバ側変換 + XSS 対策、[frontend §4.2](./docs/design/overview/frontend.md)）
- [ ] Draft / Publish / **Scheduled Publish**
- [ ] Content Warning（PRD §10）

**完了条件:** 作者が Novel を作り、記法付き Episode を執筆・Revision 管理し、公開できる。

---

## Phase 3 — Reading（読書体験）★コア

Reader First の本丸。書いたものを快適に読める。

**設計:** [reading.md](./docs/design/domains/reading.md)（Reading Progress・Library・Reader Settings 永続化・プライバシー） / [frontend §4](./docs/design/overview/frontend.md)（Reader Settings UI・CSS 変数） / [text-notation.md](./docs/design/domains/text-notation.md)（本文レンダリング） / [data-model.md](./docs/design/foundation/data-model.md)（reading_progress/library_entries）

- [ ] 作品ページ / Episode 本文の SSR（不要 JS を配らない、PRD §55）
- [ ] Reader Settings（Font Size / Line Height / Width / Font / **縦横** / Theme Light/Dark/Sepia）を CSS 変数で即時反映（[frontend §4.1](./docs/design/overview/frontend.md)）
- [ ] Reading Progress（最後の Episode/位置・読了・「続きから読む」、PRD §18）
- [ ] Library（Reading / Read Later / Completed / Favorite、PRD §19）
- [ ] SEO/メタ（Public のみ index、OGP/canonical/Structured Data、PRD §56）

**完了条件:** 発見→作品ページ→Episode 1→続きを読む→Library の読者フローが通る（成功の定義 Reader、PRD §62）。

---

## Phase 4 — Social & Notification（反応・通知）

作品に反応が集まる。

**設計:** [social-notification.md](./docs/design/domains/social-notification.md)（Like/Star/Review/Comment/Follow・通知配信） / [data-model.md](./docs/design/foundation/data-model.md)（likes/stars/reviews/comments/follows/notifications）

- [ ] Like（Episode 単位、1 user 1 Episode、取消可、PRD §20.1）
- [ ] Star（Novel 単位 1–3、PRD §20.2）/ Review（Stars+Title+Body、PRD §20.3）
- [ ] Comment（Episode 単位、読了後、PRD §20.4）
- [ ] Follow（User / Novel、PRD §21）
- [ ] Notification（初期は In-App、対象イベント一覧 PRD §22）

**完了条件:** 読者が評価・感想・フォローでき、作者に In-App 通知が届く。

---

## Phase 5 — Discovery（発見）

読者が作品にたどり着く導線。

**設計:** [discovery.md](./docs/design/domains/discovery.md)（日本語全文検索・Filter/Sort・ランキング・レコメンド・Home） / [data-model.md](./docs/design/foundation/data-model.md)（tags/novel_tags・集計方針）

- [ ] Search（Title/Catchphrase/Description/User/Tag、PRD §23）+ Filter（PRD §24）+ Sort（PRD §25）
- [ ] Ranking（Daily/Weekly/Monthly/New/Completed、時間減衰スコア、PRD §26）
- [ ] Recommendation（初期は Rule Based、PRD §27）
- [ ] Home（ログイン/ゲスト出し分け、PRD §28）
- [ ] N+1 回避（Query 層で取得、PRD §55）

**完了条件:** ゲスト/ログインの Home・検索・ランキング・おすすめから作品に到達できる。

---

## Phase 6 — Analytics（作者分析）★差別化

「作者向け Google Analytics」（PRD §29）。他サイトとの主要な差別化。

**設計:** [analytics.md](./docs/design/domains/analytics.md)（イベント収集・集計パイプライン・各ダッシュボード算出・プライバシー） / [architecture §7](./docs/design/overview/architecture.md)（分離方針） / [data-model.md](./docs/design/foundation/data-model.md)（analytics スキーマ）

- [ ] Analytics イベント収集基盤（transactional と分離、fire-and-forget、[architecture §7](./docs/design/overview/architecture.md)）
- [ ] Event Store → 集計（`analytics_events → analytics_hourly/daily`）
- [ ] Overview（PV/Unique/Like/Star/Comment/Review/Follow/Library、期間切替、PRD §30）
- [ ] Episode Analytics（Views/Unique/平均読書時間/読了率/スクロール、PRD §31）
- [ ] **Reading Funnel**（Episode 間の離脱可視化、PRD §32）
- [ ] Acquisition（流入元 + UTM、PRD §33）
- [ ] Realtime（現在の読者数、PRD §34）
- [ ] Retention（翌日/7日/30日/新話公開後の復帰、PRD §35）
- [ ] プライバシー: 集計のみ・個人行動履歴を出さない（PRD §58）

**完了条件:** 作者が作成→公開→読者獲得→分析→改善のサイクルを回せる（成功の定義 Author、PRD §62）。

---

## Phase 7 — Collaboration & Fork（共同制作・派生）★差別化

作品モデルにネイティブ組み込み（PRD §5）。

**設計:** [collaboration-fork.md](./docs/design/domains/collaboration-fork.md)（招待・Role・Fork 系譜・帰属強制・Change Proposal） / [auth.md](./docs/design/foundation/auth.md)（Role 権限マトリクス） / [data-model.md](./docs/design/foundation/data-model.md)（collaborators/forks/fork_requests/change_proposals）

- [ ] Collaborator 招待 + Role（Owner/Admin/Writer/Editor/Viewer、PRD §13）
- [ ] Role ごとの権限をサーバ側で強制（PRD §59）
- [ ] 共同編集（Revision との連携）
- [ ] Fork（派生作品、原作帰属表示は削除不可、PRD §14）
- [ ] Fork Policy（Disabled / Approval Required / Allowed、PRD §15）
- [ ] （1.0 目標・優先度低）Change Proposal = PR 型（Accept/Reject/Comment、PRD §16）

**完了条件:** 作成→招待→共同執筆→Revision 確認→公開、および Fork ができる（成功の定義 Collaboration、PRD §62）。

---

## Phase 8 — Moderation（管理・モデレーション）

健全な運用の担保。

**設計:** [moderation.md](./docs/design/domains/moderation.md)（Report/Block/Mute・Admin 対処・状態遷移） / [auth.md](./docs/design/foundation/auth.md)（Admin 権限） / [data-model.md](./docs/design/foundation/data-model.md)（reports/blocks/mutes/user_status）

- [ ] User 機能: Report(User/Novel/Episode/Comment/Review) / Block / Mute（PRD §37）
- [ ] Admin 機能: Report 管理 / Hide Novel・Episode / Delete Comment・Review / Suspend / Ban（PRD §37）

**完了条件:** 通報〜対処のモデレーション運用が回る。

---

## Phase 9 — Hardening & Launch（品質・本番化）

1.0 リリース。

**設計:** [auth.md](./docs/design/foundation/auth.md)（CSRF/認可）・[testing.md](./docs/design/reference/testing.md)（テスト戦略・高リスク領域）・[infrastructure.md](./docs/design/overview/infrastructure.md)（本番 Compose・Cloudflare Tunnel）

- [ ] セキュリティ総点検（CSRF/XSS/SQLi/Rate Limit/CSP/Secure Cookie/認可、PRD §59）
- [ ] パフォーマンス（SSR 速度・不要 JS 削減・N+1・非ブロッキング分析、PRD §55）
- [ ] アクセシビリティ点検（キーボード/aria/コントラスト/縦横切替耐性、PRD §57）
- [ ] Docker: `Dockerfile.prod` + `docker-compose.prod.yml` + `cloudflared` 本番構成（[infrastructure §4, §7](./docs/design/overview/infrastructure.md)）
- [ ] Cloudflare Tunnel 公開（ingress ポートを開けない、PRD §54）
- [ ] バックアップ/監視/ログ/migration デプロイ手順の確立

**完了条件:** PRD §60 の全項目が Production で利用可能。

---

## スケール余地（1.0 では未着手・必要時に追加）

- `redis` / `worker` / `analytics-worker` を Compose に追加（PRD §54、[infrastructure §3.2](./docs/design/overview/infrastructure.md)）
- Analytics を独立サービスへ切り出し（[architecture §10](./docs/design/overview/architecture.md)）

## 1.x 以降（Future, PRD §61）

Creator Monetization / 広告収益還元 / Payout / Paragraph Comments / 高度な Change Proposal / リアルタイム同時編集 / Custom Library Collections / 高度な推薦 / Web Push / Email / Public API / ActivityPub / Native App。
