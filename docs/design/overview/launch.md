# Launch / Hardening — デプロイ手順とローンチ点検

> 対象: 本番デプロイ手順、セキュリティ/パフォーマンス/アクセシビリティの点検状況（PRD §54–59, ROADMAP Phase 9）。
> インフラ全体像は [infrastructure.md](./infrastructure.md)。

## サマリー

- **本番は `docker/docker-compose.prod.yml`（Podman）で web + postgres + migrate(one-shot) + cloudflared を起動**。ingress ポートは一切開けず、Cloudflare Tunnel の egress 接続のみが外部との境界。
- **デプロイは「イメージビルド → migrate → web/cloudflared 起動」**。migrate はアプリ起動前のワンショットサービスとして分離（`depends_on: service_completed_successfully`）。
- **セキュリティ**: Secure/HttpOnly/SameSite Cookie、CSRF(Origin 検証)、CSP、認可のサーバ側強制、ログイン/サインアップの Rate Limiting、Argon2id、通報/BAN 系を実装済み（下表）。
- **プライバシー**: 作者分析は集計値のみ、読書履歴は本人限定（PRD §58）。

---

## 1. 本番デプロイ手順

```sh
# 1. サーバに .env を用意（コミットしない）
#    POSTGRES_PASSWORD=...  SESSION_SECRET=...  CLOUDFLARE_TUNNEL_TOKEN=...
# 2. Podman machine 起動（必要時）
podman machine start
# 3. ビルド + 起動（migrate → web → cloudflared）
podman compose -f docker/docker-compose.prod.yml up -d --build
# 4. トンネル確立を確認し、Cloudflare 側のヘルスを確認
podman compose -f docker/docker-compose.prod.yml logs -f cloudflared
```

- **migration**: `migrate` サービスが `bun run db:migrate` を実行してから `web` が起動する。ロールバックは Drizzle の履歴に従い手動（`drizzle/` の SQL）。
- **ロールバック（アプリ）**: 直前のイメージタグで `up -d` し直す。
- **バックアップ**: `renovel-pgdata` ボリュームを定期 `pg_dump`（cron 運用は別途）。

---

## 1.1 CD: self-hosted runner による自動デプロイ

`unischool` サーバは **Cloudflare Access 経由 SSH** でゲートされているため、GitHub クラウドランナーからの SSH は使わず、**サーバ上に self-hosted runner を常駐**させて `podman compose` をローカル実行する。ワークフローは [`.github/workflows/deploy.yml`](../../../.github/workflows/deploy.yml)（`main` への push / 手動実行、ラベル `unischool`）。

### 一度だけ: サーバ側ブートストラップ

```sh
# 0) 前提: podman と `podman compose`（podman-compose もしくは docker-compose provider）が入っていること
podman --version && podman compose version   # どちらも出れば OK
# 例: dnf install -y podman podman-compose   /  pip install podman-compose

# 1) デプロイユーザーを常駐可能に（rootless podman をログアウト後も動かす）
loginctl enable-linger "$USER"

# 2) リポジトリを一度 clone（runner の作業ディレクトリとは別で可。checkout は runner が行う）
#    ※ 秘密情報は .env に置かず GitHub Secrets から渡すので、clone だけでよい

# 3) GitHub Actions self-hosted runner を導入（Linux x64 例）
mkdir -p ~/actions-runner && cd ~/actions-runner
curl -o runner.tar.gz -L https://github.com/actions/runner/releases/latest/download/actions-runner-linux-x64.tar.gz
tar xzf runner.tar.gz
# 登録トークンを取得（どちらか）:
#   - GitHub UI: repo Settings → Actions → Runners → New self-hosted runner
#   - CLI:  gh api -X POST repos/novel-cluster/renovel/actions/runners/registration-token -q .token
./config.sh --url https://github.com/novel-cluster/renovel \
  --token <REGISTRATION_TOKEN> --labels unischool --name unischool-prod --unattended

# 4) サービス化（デプロイユーザーとして常駐）
sudo ./svc.sh install "$USER" && sudo ./svc.sh start
```

### 一度だけ: GitHub リポジトリ Secrets を設定

`Settings → Secrets and variables → Actions` に:

| Secret | 用途 |
|---|---|
| `POSTGRES_PASSWORD` | 本番 Postgres のパスワード（compose が参照） |
| `CLOUDFLARE_TUNNEL_TOKEN` | cloudflared のトンネルトークン |

> パスワードやトークンは**リポジトリに一切コミットしない**。SSH パスワード等も Secrets 経由。

### 以降

`main` に push（または Actions 画面から手動実行）すると、runner が checkout → `podman compose -f docker/docker-compose.prod.yml up -d --build`（migrate ワンショット → web → cloudflared）を実行し、Cloudflare Tunnel 経由で公開される。`concurrency` で多重デプロイを防止。

---

## 2. セキュリティ点検（PRD §59）

| 項目 | 状況 | 実装 |
|---|---|---|
| Session Security | ✅ | opaque token を SHA-256 で保存、`HttpOnly`+`SameSite=Lax`(+本番 `Secure`/`__Host-`)、30日・失効掃除、BAN で即時無効化 |
| パスワード | ✅ | Argon2id（`Bun.password`）、8文字以上、ユーザー不在時もタイミング均一化 |
| CSRF | ✅ | `hono/csrf`（Origin 検証）を全状態変更に適用 |
| XSS | ✅ | hono/jsx は既定エスケープ。本文記法は「escape→変換」順で安全な固定タグのみ生成（[text-notation.md](../domains/text-notation.md)） |
| CSP | ✅ | `default-src 'self'` 系。client JS は `/static` の外部ファイルのみ（inline script なし） |
| SQLi | ✅ | Drizzle のパラメータ化クエリのみ。生 SQL 連結なし |
| 認可 | ✅ | サーバ側で強制。Collaborator ロール権限マトリクス、Visibility×Status、Private/Draft は 404 秘匿、Admin は 404 秘匿 |
| Rate Limiting | ✅(初期) | login/signup に in-memory 固定窓。スケール時 Redis へ（[infrastructure.md](./infrastructure.md) §3.2） |
| 秘密情報 | ✅ | `.env` 管理・イメージに焼き込まない。Cookie/DB 認証情報は環境変数 |

**残課題（後続）**: 二重送信 Cookie の追加、パスワード漏洩リスト照合、2FA、監査ログ、外部セキュリティレビュー、エッジ WAF ルールの調整。

---

## 3. パフォーマンス点検（PRD §55）

- SSR 中心・読書画面へ不要な JS を配らない（Reader Settings/分析ビーコンのみ、依存なしの vanilla JS island）。
- 一覧/検索/ランキングは Query 層で集約し N+1 を回避。カウンタは denormalize。
- 分析イベントは fire-and-forget で読書をブロックしない。
- **残課題**: 日本語全文検索の PGroonga 化、ランキングのバッチ集計（`ranking_snapshots`）、キャッシュ層。

---

## 4. アクセシビリティ点検（PRD §57）

- Semantic HTML（`main`/`nav`/`article`/`h1..h2`/`table`）、フォーム `label`、リンク/ボタンの区別。
- Reader Settings は文字サイズ/テーマ/縦書きを提供、レイアウトは固定高さに依存しない。
- **残課題**: キーボード操作/`aria` の網羅点検、コントラスト検証、スクリーンリーダ実機確認。

---

## 5. 未実装（1.x 以降 / 後続）

Realtime/Retention/Acquisition 画面、Change Proposal、承認制 Fork、集計バッチ + worker、OAuth、Icon アップロード、Email/Push 通知（PRD §61、各ドメイン設計の「未決事項」参照）。
