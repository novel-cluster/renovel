# Infrastructure Design / インフラ・デプロイ設計

> 対象: Docker / Docker Compose 構成、開発/本番の分離、Cloudflare Tunnel 経由の公開、DB 運用。
> 正典は PRD §40, §53, §54。
> 現状: `docker/Dockerfile.dev` `docker/Dockerfile.prod` `docker/setup.sh` は**いずれも空のスタブ**。本書はこれらを埋めるための設計。

## 1. 方針（PRD §40, §54）

- コンテナは **OCI 準拠イメージ + Compose**。**ローカル開発のランタイムは Podman**（`podman compose`）を使う。イメージ/Compose ファイルは OCI 標準で Docker と互換なので、CLI（`podman` ⇔ `docker`）だけが異なる。
  - 前提: `podman machine start`（macOS）で VM を起動しておく。
  - 起動: `podman compose -f docker/docker-compose.dev.yml up --build`。
- ホストは **Self Hosted Server**（自前/自宅サーバ）。本番のオーケストレーションも Podman を第一候補とする（rootless / systemd 連携が可能）。
- 外部公開は **Cloudflare Tunnel** 経由。**サーバへ直接ポートフォワードしない**（PRD §54）。
- Runtime（アプリ）は **Bun**、DB は **PostgreSQL**。

> 用語: 本書やファイル名で "docker" と表記している箇所（`docker/` ディレクトリ、`Dockerfile.*`）は歴史的名称で、実行は Podman を用いる。

## 2. 全体トポロジ（Production, PRD §54）

```
          Cloudflare（DNS / TLS / WAF / cache）
                    │
          Cloudflare Tunnel（cloudflared）
                    │  ← ここだけが外部との境界。Ingress ポートは開けない
                    ▼
             Docker Host
        ┌───────────┴───────────┐
        ▼                       ▼
   web(Hono/Bun)  ───────►  postgres
        （内部ネットワークのみ）
```

- `web` はホストに直接ポートを晒さない。`cloudflared` が内部ネットワーク経由で `web` に到達する。
- `postgres` は内部ネットワークのみ。外部・ホストにポート公開しない（本番）。

## 3. Compose サービス構成

### 3.1 初期（1.0, PRD §54）
| service | 役割 | 公開 |
|---|---|---|
| `web` | Hono アプリ（Bun） | Tunnel 経由のみ |
| `postgres` | Source of Truth DB | 内部のみ（本番） |
| `cloudflared` | Cloudflare Tunnel クライアント（本番） | egress のみ |

### 3.2 スケール時に追加（PRD §54）
必要になったら追加できる構成にしておく:
- `redis` — セッション/キャッシュ/レートリミット
- `worker` — 非同期ジョブ（通知配信・Scheduled Publish など）
- `analytics-worker` — Analytics 集計（`analytics_events` → `analytics_hourly/daily`）。アクセス増加時に分析を独立サービスへ切り離す布石（[architecture.md](./architecture.md) §7, §10）。

## 4. 環境分離: dev / prod

2 つの Dockerfile を使い分ける（現状どちらも空。以下を実装する）。

### 4.1 `docker/Dockerfile.dev`
- 目的: ホットリロード開発（`bun run --hot src/index.ts`, `app/package.json` の `dev`）。
- 方針:
  - `oven/bun` ベース。
  - ソースは **bind mount**（コンテナに焼き込まない）。
  - `bun install` 後に `bun run dev` を起動。
  - `NODE_ENV=development`、ポートは Compose 内部でのみ公開（`localhost:3000` は dev compose 側で map してよい）。

### 4.2 `docker/Dockerfile.prod`
- 目的: 本番用の最小・不変イメージ。
- 方針:
  - **マルチステージ**（deps インストール → ソースコピー → 実行）。
  - `bun install --frozen-lockfile`（`app/bun.lock` を利用）で再現性を担保。
  - 開発依存を含めない、非 root 実行、最小レイヤ。
  - エントリは Bun で `src/index.ts`（将来 `app.ts`）を起動。
  - `NODE_ENV=production`。ヘルスチェックを定義。

### 4.3 `docker/setup.sh`
- 目的: 初期セットアップ補助（現状空）。想定する責務:
  - `.env` の雛形生成 / 必須環境変数チェック。
  - Cloudflare Tunnel（`cloudflared`）の初期化補助。
  - DB 初期化・Drizzle migration の実行トリガ。
  - 実装時は冪等に。破壊的操作（DB drop 等）はフラグ明示・確認付き。

> Compose ファイル（`docker-compose.dev.yml` / `docker-compose.prod.yml` など）はまだ存在しない。上記サービス構成に基づき別途作成する。

## 5. 環境変数（想定）

`.env`（コミットしない）で管理。少なくとも以下:
- `DATABASE_URL`（postgres 接続; 本番は内部ネットワークのホスト名）
- `SESSION_SECRET` / OAuth Provider の client id/secret（Provider は別途決定, PRD §52）
- `CLOUDFLARE_TUNNEL_TOKEN`（cloudflared 用, 本番）
- `NODE_ENV`, `PORT`

シークレットはイメージに焼き込まない。`docker/setup.sh` で存在チェックする。

## 6. データベース運用（PRD §53）

- PostgreSQL を Source of Truth。
- **Migration 必須**（Drizzle）。デプロイ手順に migration 実行を組み込む（`web` 起動前 or 専用ワンショット）。
- Foreign Key を積極利用。
- Analytics data と transactional data を分離（同一 Postgres 内でもスキーマ/テーブルを分け、将来別インスタンスへ移せるように）。
- バックアップ: `postgres` のボリュームを永続化し、定期ダンプを取得（運用手順は別途）。

## 7. ネットワーク / セキュリティ

- 本番は **ingress ポートを一切開けない**（Cloudflare Tunnel の egress 接続のみ）。
- Cloudflare 側で TLS 終端・WAF・レート制御を活用（アプリ側 Rate Limiting と二重, PRD §59）。
- コンテナ間は Docker 内部ネットワークで通信。`postgres` はホスト公開しない。
- アプリ配信は Secure Cookie / CSP など（PRD §59、詳細は [architecture.md](./architecture.md) §9）。

## 8. デプロイフロー（想定）

```
1. コード push / タグ
2. Dockerfile.prod でイメージビルド
3. Docker Host へ配布（registry or ローカルビルド）
4. Drizzle migration 実行
5. podman compose up -d（web / postgres / cloudflared）
6. cloudflared がトンネル確立 → Cloudflare 経由で公開
7. ヘルスチェック確認
```

CI/CD の具体は未定（1.0 では手動 or 簡易スクリプト可）。`setup.sh` を土台にする。

## 9. 未決事項 / TODO
- [ ] `Dockerfile.dev` / `Dockerfile.prod` / `setup.sh` の実装（現状空）
- [ ] `docker-compose.dev.yml` / `docker-compose.prod.yml` の作成
- [ ] Drizzle 導入と migration 運用フローの確定
- [ ] OAuth / Session Provider の決定（PRD §52）
- [ ] バックアップ・監視・ログ集約の方針
