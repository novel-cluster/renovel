# Frontend Design / フロントエンド設計

> 対象: SSR + Islands 方針、UI コンポーネント（Kiwa UI）、読書/執筆画面、Reader Settings、クライアント JS の境界。
> 正典は PRD §17–20, §39–40, §50, §55–57。現状は scaffold。

## 1. レンダリング方針

- **サーバ中心・SSR ファースト。** ページは `hono/jsx` で HTML を返す（PRD §49）。
- **Islands Architecture。** インタラクティブな部品だけを `hono/jsx/dom` でクライアント描画する。ページ全体の Client Rendering は原則避ける（PRD §50）。
- **読書画面には不要な JS を配らない**（PRD §55, Reader First）。読むだけの画面は基本 HTML/CSS のみで成立させる。

### 1.1 Islands 候補（PRD §50）
`hono/jsx/dom` を使う対象:
- Editor Autosave（執筆の自動保存）
- Reader Settings（文字サイズ・行間・テーマ等の即時反映）
- Analytics Graph（ダッシュボードのグラフ）
- Notification UI（未読・ドロップダウン）
- Search Filter（絞り込み）
- Realtime Analytics（現在読者数）

上記以外は SSR + 素の HTML を第一候補とする。

## 2. UI コンポーネント: Kiwa UI

- **Kiwa UI** を第一候補とする（PRD §40）。shadcn 系のレジストリ方式で、コンポーネントを `@/components` に取り込んで使う。
- 設定は [`app/src/kiwa-ui.json`](../../app/src/kiwa-ui.json):
  - `aliases.components` → `@/components`
  - `aliases.utils` → `@/lib/utils`（`cn()` を提供）
  - Tailwind css は `styles/globals.css`
- **クラス結合は `cn()`**（`app/src/lib/utils.ts`、`clsx` + `tailwind-merge`）を使う。
- 不足するコンポーネントは独自実装する（PRD §40）。実装は `presentation/components/` に置き、Kiwa UI の流儀（Tailwind + variant）に合わせる。

### 2.1 スタイル基盤
- **Tailwind v4**（`@import "tailwindcss"`）。`styles/globals.css` に shadcn 互換の CSS 変数（`--color-background` 等）と V1 拡張トークンを定義済み。
- ダークモードは `.dark` クラス起点（`@custom-variant dark (&:is(.dark *))`）。
- フォントは Inter（`rsms.me/inter`）。ただし**読書本文のフォントは Reader Settings で切替可能**にするため、本文用フォントは別トークンで管理する。

## 3. 画面カテゴリ

| カテゴリ | 例 | レンダリング |
|---|---|---|
| Discovery | Home / Search / Ranking / `/@{handle}` | SSR。Search Filter のみ island |
| Reading | 作品ページ / Episode 本文 | SSR 中心。Reader Settings と進捗計測が island |
| Writing | Editor / Revision History / Novel 設定 | SSR + Editor island（autosave/preview） |
| Analytics | Overview / Episode / Funnel / Realtime | SSR + グラフ/Realtime island |
| Social/Notification | 通知・フォロー・コメント | SSR + 通知 island |

## 4. 読書画面（Reader）— 最重要（PRD §17, §18, §55, §57）

本文への集中を最優先。装飾・UI を最小化する。

### 4.1 Reader Settings（PRD §17）
ユーザーが変更できる項目:
- Font Size / Line Height / Content Width / Font
- Writing Direction: **Horizontal / Vertical**（縦書き対応）
- Theme: **Light / Dark / Sepia**

実装方針:
- 設定は CSS 変数（`--reader-font-size` 等）で表現し、`<html>`/コンテナに反映。island は変数を書き換えるだけで**再レンダリングやレイアウトシフトを最小化**（PRD §55）。
- 縦書きは `writing-mode: vertical-rl` を切替。横書きとで段落・ルビ・傍点が破綻しないこと。
- 設定は localStorage に保持しつつ、可能なら初期 HTML に反映して FOUC を避ける（サーバ側で cookie 反映も検討）。
- Theme は `.dark` / sepia 用クラスで切替。

### 4.2 本文レンダリング（記法, PRD §11）
Editor はプレーンテキスト。表示時に独自記法を HTML へ変換する。
- ルビ: `｜文章《ルビ》` → `<ruby>文章<rt>ルビ</rt></ruby>`
- 傍点(強調): `《《文章》》` → 傍点付き表示
- **変換はサーバ側（View）で行い、XSS 対策として本文は必ずエスケープしてから記法適用**。記法変換ロジックは `shared` もしくは writing ドメインの表示ユーティリティに切り出し、Editor プレビューと共通化する。

### 4.3 Reading Progress（PRD §18）
- 記録: 最後に読んだ Episode / 位置 / 読了済み Episode / 最終閲覧日時。
- 作品ページに「**続きから読む**」を提供。
- 進捗・スクロールは Analytics イベント（`episode_progress_25/50/75`, `episode_complete`）と連動するが、**送信は非ブロッキング**（[architecture.md](./architecture.md) §7）。

## 5. 執筆画面（Editor）（PRD §11, §12）

- **Markdown ではなくプレーンテキスト**。記法はルビ/傍点のみ（Writing Should Be Invisible）。
- 必須機能: 自動保存 / 手動保存 / Preview / 文字数表示 / Draft / Publish / Scheduled Publish / Revision History / Revision Restore。
- Editor 本体は island。
  - Autosave: 一定間隔 or 変更検知で下書き保存（PATCH）。競合や保存状態を UI に明示。
  - Preview: 4.2 の記法変換を共通ロジックで再利用し、本文と同じ見た目を出す。
  - 文字数: リアルタイム表示。
- Revision History は SSR で一覧、差分/復元操作を提供（PRD §12）。

## 6. アクセシビリティ（PRD §57）
- Semantic HTML / キーボードナビゲーション / 適切なコントラスト / aria 属性 / スクリーンリーダ対応。
- 特に読書画面は**文字サイズ・行間の変更に耐えるレイアウト**（固定高さに依存しない）。

## 7. SEO / メタ（PRD §56）
- Public な Novel/Episode は各ページに title / description / canonical / Open Graph / Structured Data を付与。
- **Unlisted / Private は noindex**。SSR なので meta はサーバ側で確実に出す。

## 8. パフォーマンス指針（PRD §55）
- SSR ページを高速返却。
- Reader 画面へ不要な JavaScript を配らない（island を最小に）。
- Reader Settings 変更でレイアウトシフトを最小化。
- 一覧/検索で N+1 を作らない（データ取得は Application の Query 層に寄せる）。

## 9. 規約
- import alias: `@/*` → `src/*`（`app/tsconfig.json`）。Kiwa UI スコープの `app/src/tsconfig.json` では `@/*` → `./*`。
- JSX は `hono/jsx`（`jsxImportSource: "hono/jsx"`）。React ではない点に注意（hook 等の差異）。
- クラス結合は常に `cn()`。生の文字列連結でクラスを組まない。
