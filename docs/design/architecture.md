# Architecture Design / 全体アーキテクチャ設計

> 対象: バックエンド全体構成・レイヤ分割・ドメイン境界・リクエストフロー。
> 正典は PRD §39–59。本書は実装に落とすための補足と決定を記す。
> 現状は scaffold（`app/src/index.ts` の Hello のみ）。本書の構成は未実装の目標形。

## 1. 方針

- Web アプリの中心を **Hono** で構築し、SPA フレームワークに依存しない（PRD §39）。
- アーキテクチャは **DDD + MVC + Service Layer（DDD + MVC + S）**（PRD §41）。
- Runtime は **Bun**、DB は **PostgreSQL**、ORM は **Drizzle**。

## 2. レイヤ構成（PRD §45）

```
Presentation  … Hono controllers / routes / views(hono/jsx) / middleware
      ↓ 呼ぶ
Application   … Application Service(=Use Case) / DTO / Read Query
      ↓ 使う
Domain        … Entity / Value Object / Repository interface / Domain Service
      ↑ 実装する
Infrastructure… Drizzle schema・Repository 実装 / storage / external
```

依存の向き（重要）:
- Presentation → Application → Domain の一方向。
- Infrastructure は Domain が定義した **Repository interface を実装する**（依存性逆転）。
- **Domain は Hono `Context` にも Drizzle にも依存しない。** 認証・トランザクション・DB の詳細を持ち込まない。

## 3. ディレクトリ構成（PRD §46, §47）

```
app/src/
├ index.ts                 … 現状の scaffold（将来 app.ts / エントリに整理）
├ presentation/
│  ├ controllers/          … 薄い。入力取得→Service 呼び出し→Response
│  ├ routes/               … Hono ルーティング定義
│  ├ views/                … hono/jsx による SSR View
│  ├ components/           … Kiwa UI ベースの UI コンポーネント
│  └ middleware/           … 認証・CSRF・rate limit など
├ application/
│  ├ services/             … CreateNovelService など Use Case 単位
│  ├ dto/
│  └ queries/              … 読み取り専用（一覧/検索/分析ダッシュボード）
├ domain/
│  ├ identity/ novel/ writing/ collaboration/ fork/
│  ├ reading/ social/ discovery/ analytics/ notification/ moderation/
│  └ （各ドメインは entities/ value-objects/ repositories/ services/ errors/）
├ infrastructure/
│  ├ database/{drizzle,schema,repositories}/
│  ├ storage/
│  └ external/
└ shared/{errors,utils,types}/
```

Novel ドメインの内部例（PRD §47）:
```
domain/novel/
├ entities/        novel.ts / chapter.ts / episode.ts
├ value-objects/   novel-title.ts / novel-status.ts / visibility.ts
├ repositories/    novel-repository.ts   ← interface のみ
├ services/        novel-domain-service.ts
└ errors/
```
Repository の **interface は domain/application 側**、**Drizzle 実装は infrastructure 側**に置く。

## 4. ドメイン境界（PRD §42）

`identity / novel / writing / collaboration / fork / reading / social / discovery / analytics / notification / moderation`。

主要ドメインの責務メモ:

| Domain | 責務 | 要点 |
|---|---|---|
| identity | User / Handle / Profile / 認証コンテキスト | `/@{handle}` で公開 |
| novel | Novel / Chapter / Episode / メタデータ | `Novel→(任意)Chapter→Episode`。表紙画像なし |
| writing | Editor・Revision・Draft・Publish・Scheduled | `Episode→EpisodeRevision[]`。上書きしない |
| collaboration | Collaborator / Role / 招待 | Owner/Admin/Writer/Editor/Viewer |
| fork | 派生作品・Fork Policy・帰属 | 帰属表示は削除不可 |
| reading | Reading Progress / Reader Settings / Library | 続きから読む |
| social | Like / Star / Review / Comment / Follow | Like=Episode, Star=Novel(1–3) |
| discovery | Search / Ranking / Recommendation / Home | 時間減衰スコア |
| analytics | Event 収集・集計・ダッシュボード | transactional と分離 |
| notification | In-App 通知（将来 Push/Email） | |
| moderation | Report / Block / Mute / Ban | サーバ側で強制 |

## 5. リクエストフロー

### 5.1 コマンド系（PRD §48）例: Episode 公開
```
POST /novels/:novelId/episodes/:episodeId/publish
  → EpisodeController（入力+認証コンテキスト取得）
  → PublishEpisodeService（Use Case）
  → Episode Domain + EpisodeRepository
  → PostgreSQL
```
Controller に業務ロジックを書かない。

### 5.2 SSR 系（PRD §49）例: 作品閲覧
```
GET /novels/:slug
  → NovelController → GetNovelService → NovelRepository → PostgreSQL
  → NovelView(hono/jsx) → HTML
```

## 6. 認証・認可（PRD §52, §59）

- 認証は Session + OAuth を想定（Provider は別途決定）。
- 認証結果は **Hono Context** に載せる: `c.get("user")`, `c.get("session")`。
- Controller/Application が Context から取り出し、必要な情報だけを Domain/Service に渡す。**Domain は Context を知らない。**
- **認可はサーバ側で必ず実施。** 特に Collaborator Role・Private Novel・Draft Episode の閲覧/編集権限は UI 任せにしない。

## 7. Analytics アーキテクチャ（PRD §51, §36, §58）

分析イベントを transactional data から**物理的に分離**し、後から別サービスへ切り出せる構造にする。

```
Browser → Analytics Endpoint → Event Store(analytics_events)
        → Aggregation → analytics_hourly / analytics_daily → Dashboard
```

- 送信は **fire-and-forget**。読書操作をブロックしない（PRD §55）。
- イベント例: `novel_view` `episode_view` `episode_read_start` `episode_progress_25/50/75` `episode_complete` `next_episode` `like` `star` `review` `comment` `follow` `library_add` `search_click` `recommendation_click`。
- イベントには必要最小限のみ保存。過剰なユーザー追跡はしない。
- 作者に返すのは**集計値のみ**。個人単位の「誰がいつどこまで読んだか」は出さない。

## 8. データベース方針（PRD §53）

- PostgreSQL を Source of Truth。
- Foreign Key を可能な限り使う。
- **Migration 必須**（Drizzle migration）。
- Soft Delete が必要なドメインは明示（例: Novel/Episode の hide、User の suspend/ban）。
- Analytics data と transactional data を分離。
- DB 実装は Repository で隠蔽し、Domain から見えないようにする。

## 9. 横断的関心事

| 関心事 | 方針 |
|---|---|
| Security | CSRF/XSS/SQLi 対策、Rate Limiting、Secure Cookie、CSP、Input Validation（PRD §59） |
| Performance | SSR 高速返却、Reader へ不要 JS を配らない、検索/一覧で N+1 回避、分析送信は非ブロッキング（PRD §55） |
| SEO | Public のみ index。title/description/canonical/OGP/Structured Data。Unlisted/Private は noindex（PRD §56） |
| Accessibility | Semantic HTML、キーボード操作、コントラスト、aria、スクリーンリーダ（PRD §57） |
| Privacy | 分析は集計のみ、不要な個人追跡なし（PRD §58） |

## 10. スケール余地

Compose に後から `redis` / `worker` / `analytics-worker` を追加できる構成にしておく（PRD §54）。アクセス増加時は Analytics 部分を独立サービスとして切り離す。
