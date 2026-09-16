# ReNovel Documentation

ReNovel の企画・設計ドキュメント索引。

プロダクトの正典は リポジトリルートの [`PRD.md`](../PRD.md)。本 `docs/` はその PRD を土台に、実装のための企画・設計判断をまとめる。**現状リポジトリは scaffold 段階**（`app/src/index.ts` は Hono の Hello スタブ）であり、本ドキュメント群は「これから何をどう作るか」を示す設計文書である。

## Index

### Planning（企画）
- [企画書 / Product Proposal](./planning/proposal.md) — なぜ作るか、誰に、何を、どう差別化するか

### Design（設計）

**全体・横断**
- [Architecture / 全体アーキテクチャ](./design/architecture.md) — レイヤ構成・ドメイン分割・リクエストフロー
- [Frontend / フロントエンド設計](./design/frontend.md) — SSR + Islands、Kiwa UI、読書/執筆 UI、Reader Settings
- [Infrastructure / インフラ設計](./design/infrastructure.md) — Docker / Compose / Cloudflare Tunnel / デプロイ
- [Data Model / データモデル](./design/data-model.md) — 全ドメインの PostgreSQL スキーマ・ERD・enum・index（**他文書が参照する正典**）
- [Routing / URL・ルート設計](./design/routing.md) — URL/slug 設計、全ルート表、SSR / island API / 分析エンドポイントの区分
- [Auth / 認証・認可](./design/auth.md) — Session + OAuth、権限マトリクス、Visibility×Status アクセス判定、CSRF
- [Glossary / 用語集](./design/glossary.md) — ユビキタス言語、紛らわしい語の区別
- [Testing / テスト戦略](./design/testing.md) — レイヤ別テスト方針、高リスク領域、CI

**ドメイン別**
- [Text Notation / 記法パーサ](./design/text-notation.md) — ルビ・傍点・自動ルビの文法と XSS 安全な変換
- [Writing & Revision / 執筆・改訂](./design/writing-revision.md) — Episode ライフサイクル、Revision、Autosave、予約公開
- [Reading / 読書](./design/reading.md) — Reading Progress、Library、Reader Settings 永続化、プライバシー
- [Social & Notification / 反応・通知](./design/social-notification.md) — Like/Star/Review/Comment/Follow、通知配信
- [Discovery / 発見](./design/discovery.md) — 日本語全文検索、Filter/Sort、ランキング、レコメンド、Home
- [Analytics / 作者分析](./design/analytics.md) — イベント収集、集計パイプライン、各ダッシュボード算出、プライバシー
- [Collaboration & Fork / 共同制作・派生](./design/collaboration-fork.md) — 招待・Role、Fork 系譜・帰属強制、Change Proposal
- [Moderation / モデレーション](./design/moderation.md) — Report/Block/Mute、Admin 対処、状態遷移

## ドキュメント規約
- 言語は日本語（PRD・コミットに合わせる）。技術用語は英語のまま用いてよい。
- PRD の該当節を参照するときは `PRD §N` 形式で示す。
- 設計判断はできる限り「決定 / 理由 / 代替案」の形で残す。
