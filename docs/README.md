# ReNovel Documentation

ReNovel の企画・設計ドキュメント索引。

プロダクトの正典は リポジトリルートの [`PRD.md`](../PRD.md)。本 `docs/` はその PRD を土台に、実装のための企画・設計判断をまとめる。**現状リポジトリは scaffold 段階**（`app/src/index.ts` は Hono の Hello スタブ）であり、本ドキュメント群は「これから何をどう作るか」を示す設計文書である。

## Index

### Planning（企画）
- [企画書 / Product Proposal](./planning/proposal.md) — なぜ作るか、誰に、何を、どう差別化するか

### Design（設計）
- [Architecture / 全体アーキテクチャ](./design/architecture.md) — レイヤ構成・ドメイン分割・リクエストフロー
- [Frontend / フロントエンド設計](./design/frontend.md) — SSR + Islands、Kiwa UI、読書/執筆 UI、Reader Settings
- [Infrastructure / インフラ設計](./design/infrastructure.md) — Docker / Compose / Cloudflare Tunnel / デプロイ

## ドキュメント規約
- 言語は日本語（PRD・コミットに合わせる）。技術用語は英語のまま用いてよい。
- PRD の該当節を参照するときは `PRD §N` 形式で示す。
- 設計判断はできる限り「決定 / 理由 / 代替案」の形で残す。
