# Analytics Design / 分析ドメイン詳細設計

> 対象: Analytics ドメイン（イベント収集 → 集計 → 作者向けダッシュボード）。ReNovel の差別化の核＝**「作者向け Google Analytics」**（PRD §29）。
> 正典は PRD §29–36, §51, §55, §58。本書は [architecture.md](./architecture.md) §7 の概要を実装粒度まで詳細化する。
> テーブル名／カラム名の正典は [data-model.md](./data-model.md)（`analytics` スキーマ）。本書はそこに定義された名前を厳密に踏襲し、再定義しない。
> ルート表は [routing.md](./routing.md) §3.5、集計ワーカーの配置は [infrastructure.md](./infrastructure.md)。現状は scaffold（Phase 0 完了）で、本書は目標形。

## サマリー

- **収集は fire-and-forget の一本道** `POST /api/analytics/events`。読書操作を一切ブロックせず（`navigator.sendBeacon` 前提）、バリデーション失敗も `202` 相当で握りつぶす（PRD §55）。生イベントは `analytics.analytics_events` へ append-only で積む。
- **二段集計パイプライン** `analytics_events → analytics_hourly → analytics_daily` を `analytics-worker`（[infrastructure.md](./infrastructure.md)）が定期実行。**冪等な UPSERT（`ON CONFLICT`）** で再集計・重複投入に耐え、遅延イベントは所属バケットへ後追い加算する。
- **Unique Readers は `session_id`（匿名 visitor）× バケット単位の distinct** で近似する。個人特定はしない。bot 除外・重複排除・進捗イベントの単調化（25→50→75→complete）を収集/集計の両段で担保。
- **6 ダッシュボードの算出式を確定**: Overview（§30）・Episode（§31）・Reading Funnel（§32）・Acquisition（§33）・Realtime（§34）・Retention（§35）。各指標に「元イベント / 集計元テーブル / 粒度 / 式」を表で対応付けた。
- **プライバシー保証（PRD §58）**: 作者へ返すのは集計値のみ。個人単位の「誰がいつどこまで読んだか」は API・画面のいずれからも露出しない。**最小母数 k（既定 5）未満のセルはマスク**し、`user_id` は集計にのみ使い作者へ返さない。
- **物理分離**: `analytics` は独立 Postgres スキーマで transactional に FK を張らない。将来 `analytics-worker` ごと別サービス／別 DB へ切り出せる（PRD §51, §54）。

---

## 1. スコープ・責務・関連文書

Analytics ドメインの責務は「**読者行動イベントを集め、作者に集計インサイトとして返す**」こと。トランザクション（Like を押す・Star を付ける等の永続化）は social ドメイン（[social-notification.md](./social-notification.md)）の仕事で、Analytics はその**副作用としての観測イベント**を受けるだけ。両者は別物として扱う（`like` イベントの受信はカウント用であり、Like 本体の real state は social 側の集計 `social_counts` が正）。

| 関心 | 本書 | 他書 |
|---|---|---|
| イベントの器（テーブル定義） | 参照のみ | [data-model.md](./data-model.md) `analytics` スキーマ |
| 収集/集計/ダッシュボード算出 | **本書** | — |
| 送信エンドポイントの URL 規約 | 詳細ロジック | [routing.md](./routing.md) §3.5 |
| worker コンテナ・スケジュール実行基盤 | ジョブ設計 | [infrastructure.md](./infrastructure.md) |
| 読書画面からのイベント発火（island） | 発火契機の定義 | [reading.md](./reading.md), [frontend.md](./frontend.md) §4.3 |
| Ranking への素データ供給 | 供給契約 | [discovery.md](./discovery.md) |
| 認可（誰がダッシュボードを見れるか） | 要件のみ | [auth.md](./auth.md) |

### 1.1 DDD レイヤ上の配置

```
presentation/
  controllers/AnalyticsIngestController.ts     … POST /api/analytics/events（薄い・常に 202）
  controllers/AnalyticsDashboardController.ts  … /studio/.../analytics/*（SSR + chart API）
application/
  services/RecordEventService.ts               … 収集 Use Case（正規化→enqueue/insert）
  queries/GetAnalyticsOverviewQuery.ts         … 読み取り専用（集計表を読むだけ）
  queries/GetEpisodeAnalyticsQuery.ts
  queries/GetReadingFunnelQuery.ts
  queries/GetAcquisitionQuery.ts
  queries/GetRetentionQuery.ts
  queries/GetRealtimeReadersQuery.ts
domain/analytics/
  value-objects/  event-type.ts / metric.ts / analytics-window.ts / visitor-id.ts
  services/       event-normalizer.ts（bot 判定・進捗単調化・props 最小化）
  repositories/   analytics-event-sink.ts（interface）/ analytics-read-repository.ts（interface）
infrastructure/
  database/repositories/DrizzleAnalyticsEventSink.ts
  database/repositories/DrizzleAnalyticsReadRepository.ts
  jobs/HourlyRollupJob.ts / DailyRollupJob.ts / RetentionRollupJob.ts   … analytics-worker が実行
```

- **Domain は Hono `Context`・Drizzle に依存しない**（[architecture.md](./architecture.md) §2）。イベントの器への書き込みは `AnalyticsEventSink` interface 越し。
- ダッシュボードは **Read Query（CQRS の read 側）** に寄せ、集計表を読むだけにする。Query は Domain Entity を組み立てず DTO を直接返してよい（読み取り専用のため N+1 回避を優先、PRD §55）。

---

## 2. 設計原則（決定 / 理由 / 代替案）

| # | 決定 | 理由 | 代替案（不採用） |
|---|---|---|---|
| P1 | 収集は **fire-and-forget** の単一エンドポイント | 読書を絶対にブロックしない（PRD §55）。送信失敗が UX を壊さない | 同期 API で結果を待つ（読書がネットワークに引きずられる） |
| P2 | イベントは **append-only**・後段で集計 | 書き込みを最速・最小ロックに保ち、集計はまとめて非同期 | リクエスト時にカウンタを直接インクリメント（ホットロウ競合・分離不能） |
| P3 | `analytics` を **物理分離スキーマ**・FK なし | 将来 analytics を別サービス/別 DB へ切り出せる（PRD §51, §54） | transactional に同居（切り出し時に依存が絡む） |
| P4 | Unique は **`session_id` distinct** 近似 | ログイン不要で計測でき、個人追跡を避けられる（PRD §58） | `user_id` 前提の厳密 unique（未ログイン読者を落とす・追跡的） |
| P5 | 作者へは **集計値のみ**・最小母数マスク | PRD §58 の「個人単位を出さない」を構造で保証 | 生ログ閲覧を許す（プライバシー原則違反） |

---

## 3. イベント収集（Ingestion）

### 3.1 エンドポイント設計

```
POST /api/analytics/events
  → AnalyticsIngestController（入力パース + 匿名 session_id 解決）
  → RecordEventService（正規化・bot 判定・sink へ）
  → AnalyticsEventSink（→ analytics.analytics_events）
常に 202 Accepted（body 空）を即返す。
```

**fire-and-forget 契約**（[routing.md](./routing.md) §4）:

- クライアントは **`navigator.sendBeacon('/api/analytics/events', blob)`** を第一手段とする。ページ遷移・タブ離脱時も送信が保証され、レスポンスを待たない。sendBeacon 非対応/失敗時は `fetch(url, { keepalive: true })` にフォールバック。
- サーバは **入力を最小検証し、何があっても `202` を返す**。未知 `event_type`・欠損フィールド・JSON 破損・rate 超過はすべて**黙って破棄**して 202（＝計測は best-effort、UX を守る）。エラーを client へ返さない。
- **認証は任意**。ログイン時は middleware が解決した `c.get("user")` から `user_id` を付す。未ログインは `session_id`（匿名 visitor）のみ。
- **CSRF 免除**: このエンドポイントは副作用が append-only の観測ログのみで、CSRF トークン必須にすると sendBeacon が使えなくなるため免除する。代わりに **`Origin`/`Referer` 検証**と rate limit（§3.6）で保護。書き込み先は分離スキーマで transactional を汚さない。
- **バッチ送信可**: body は単一イベント or イベント配列（最大 20 件）。読書中に溜めた進捗イベントを離脱時にまとめて 1 beacon で送れる。

> なぜ Controller で処理を完結せず Service を挟むか: bot 判定・進捗単調化・props 最小化という**ドメインロジック**があるため。Controller は「パースして 202」だけ、正規化は `RecordEventService` + `EventNormalizer`（domain service）に置く（[architecture.md](./architecture.md) §5.1）。

### 3.2 送信ペイロード

クライアントが送る JSON（キーは snake_case、`analytics_events` 列に対応）:

```jsonc
{
  "event_type": "episode_progress_50",   // 必須。§3.3 カタログ内のみ有効
  "target_type": "episode",              // "novel" | "episode" | "user" | null
  "target_id":   "0192f3c4-…",           // target の UUID
  "novel_id":    "0192aaaa-…",           // 集計軸。episode 系は必須（サーバ側で補完可）
  "referrer":    "https://x.com/…",      // 任意。Acquisition 用（§6.4）
  "utm": { "source": "x", "medium": "social", "campaign": "spring" }, // 任意
  "props": { "scroll_pct": 52, "from_episode_no": 3, "to_episode_no": 4 } // イベント固有・最小
}
```

サーバが**付与/上書き**する項目（クライアントを信用しない）:

| 列 | 供給元 | 備考 |
|---|---|---|
| `id` | サーバ（UUIDv7） | 到着順 ≒ 時系列 |
| `session_id` | Cookie（§3.5） | クライアント body の値は無視 |
| `user_id` | `c.get("user")` | ログイン時のみ。body の値は無視（なりすまし防止） |
| `occurred_at` | サーバ `now()`（UTC） | クライアント時刻は信用しない。ただし beacon 遅延補正のため body に `client_ts` があれば props に保存し監査に使う |
| `utm_source/medium/campaign` | body `utm.*` を正規化 | 小文字化・許可長トリム |
| `referrer` | body or `Referer` ヘッダ | ホスト部のみ抽出して分類（§6.4）。生 URL は保存するが PII を含む query は落とす |
| `props` | body `props` を**allowlist フィルタ** | イベント種別ごとに許可キーを固定（§3.3）。未知キーは破棄（PRD §36「必要最低限」） |

### 3.3 イベント種別カタログ（PRD §36 を精緻化）

`architecture.md` §7 の一覧を、**発火契機・target・許可 props・集計 metric** まで具体化する。

| event_type | 意味 / 発火契機 | target_type | 主要 props（allowlist） | 供給する metric | 発火元 |
|---|---|---|---|---|---|
| `novel_view` | 作品ページ表示 | novel | — | `views`, `unique_readers`(novel) | 作品ページ SSR（[reading.md](./reading.md)） |
| `episode_view` | Episode 本文ページ表示 | episode | — | `views`, `unique_readers`(episode) | Episode ページ SSR |
| `episode_read_start` | 本文表示後スクロール開始/一定時間滞在 | episode | — | `read_starts` | 読書 island |
| `episode_progress_25` | スクロール到達 25% | episode | `scroll_pct` | `progress_25` | 読書 island（IntersectionObserver） |
| `episode_progress_50` | 到達 50% | episode | `scroll_pct` | `progress_50` | 同上 |
| `episode_progress_75` | 到達 75% | episode | `scroll_pct` | `progress_75` | 同上 |
| `episode_complete` | 読了（末尾到達 or 100%）| episode | `dwell_ms` | `completes`, `reading_time_ms` | 読書 island |
| `next_episode` | 次話へ遷移操作 | episode | `from_episode_no`, `to_episode_no` | `next_transitions` | 次話ボタン |
| `like` | Episode に Like（PRD §20.1）| episode | — | `likes` | social island |
| `star` | Novel に Star（1–3, PRD §20.2）| novel | `stars`(1–3) | `stars`, `star_points` | social island |
| `review` | Review 投稿（PRD §20.3）| novel | — | `reviews` | Review フォーム |
| `comment` | Comment 投稿（PRD §20.4）| episode | — | `comments` | Comment フォーム |
| `follow` | User/Novel フォロー（PRD §21）| novel/user | `follow_kind`(novel\|user) | `follows` | social island |
| `library_add` | Library 追加（PRD §19）| novel | — | `library_adds` | Library ボタン |
| `search_click` | 検索結果クリック流入（PRD §23）| novel | `query_hash`, `rank` | `acq_search` | 検索結果ページ |
| `recommendation_click` | 推薦枠クリック流入（PRD §27）| novel | `surface`, `rank` | `acq_reco` | Home/推薦枠 |

規則:

- **`dwell_ms`（読書時間）は `episode_complete` に載せる**。island が read_start からの経過をローカルで測り、離脱/読了時に 1 度だけ送る。前面/背面（`visibilitychange`）で計測を一時停止し、放置による過大計上を防ぐ。上限クランプ（例 60 分）で外れ値を除去。
- **`search_click` の `query_hash`** は検索語そのものではなく**ハッシュ**を保存（原文クエリを永続化しない＝プライバシー）。
- `props` は上表の allowlist キーのみ通す。未知キーは `EventNormalizer` が破棄。

### 3.4 target_type / target_id / novel_id の扱い

- **`novel_id` は全集計の主軸**。episode 系イベントでも `novel_id` を必ず埋める（クライアントが送るか、サーバが `target_id`=episode_id から解決）。集計・ダッシュボード認可（作品所有者判定）がすべて `novel_id` 起点のため。
- `target_type`/`target_id` は polymorphic な緩い参照（FK なし）。`novel`/`episode`/`user` を取る。
- **`novel_id` 解決の N+1 回避**: episode→novel の対応はキャッシュ（redis, [infrastructure.md](./infrastructure.md)）に載せ、収集ホットパスで毎回 DB を引かない。未解決なら `novel_id=null` のまま受け、後段 rollup で補完してもよい（best-effort）。

### 3.5 visitor / session の識別（PRD §58 準拠）

Unique Readers を**ログイン不要**で数えつつ**個人特定しない**ための識別子設計。

| 識別子 | 実体 | 用途 | 寿命 |
|---|---|---|---|
| **visitor / `session_id`** | 匿名 Cookie `rnv_vid`（UUIDv4, HttpOnly, SameSite=Lax, Secure） | Unique Readers 近似・Retention の cohort キー | 既定 **180 日**ローリング。認証 session とは別物 |
| `user_id` | 認証済みユーザー（[auth.md](./auth.md)）| 集計内部の重複統合にのみ使用。**作者へは返さない** | 認証 session に従う |

- **`rnv_vid` は認証 session（`sessions.token_hash`）とは完全に別 Cookie**。ログアウトしても visitor は継続し、ログイン前後で同一読者を（ベストエフォートで）つなげる。名前は分析専用と分かる `rnv_vid`。
- `analytics_events.session_id` にはこの `rnv_vid` を格納する（列名は data-model 準拠。意味は「匿名 visitor」）。**個人を指すものではない**とコメントで明示（data-model.md L603）。
- **統合ルール**: 同一バケット内で同一読者を二重計上しないため、Unique は「`user_id` があればそれ、無ければ `session_id`」を distinct キーにする（§4.1 の `visitor_key`）。これにより「未ログインで読み始め→途中でログイン」を 1 人として扱える。
- **PII を持たない**: IP アドレス・User-Agent 生文字列は `analytics_events` に**保存しない**。bot 判定（§3.6）に使った後は破棄。地域分析等はスコープ外（[未決事項](#9-未決事項)）。

### 3.6 bot 除外・重複排除・Unique の定義

**Bot 除外**（収集段＝書き込み前で落とす）:

1. **UA ヒューリスティック**: 既知 crawler（`bot`, `spider`, `crawl`, `slurp`, `preview`, `HeadlessChrome` 等）の UA は `EventNormalizer` が drop。
2. **`Sec-Fetch-*` / prefetch**: `Sec-Purpose: prefetch` や `Purpose: prefetch` を持つプリフェッチは view として数えない。
3. **無 Cookie の連打**: `rnv_vid` を保持しない（Cookie を返さない）client からの高頻度 view は bot 疑いとして rate limit で抑制。
4. **rate limit**: visitor あたり `POST /api/analytics/events` を **60 req/min**（redis, [infrastructure.md](./infrastructure.md)）。超過分は 202 のまま破棄。

> bot 判定に使う UA/IP は**その場限り**。`analytics_events` に残さない。誤判定しても view が減るだけで UX に影響しない（fire-and-forget）。

**重複排除（dedup）**:

- **view 系のクライアント dedup**: `episode_view`/`novel_view` は 1 ページ表示で 1 回のみ発火（island 側でページロードごとにガード）。リロードは別 view として許容。
- **進捗の単調化**: `episode_progress_25/50/75`/`complete` は**しきい値ごと 1 回**。island が到達済みしきい値を記憶し再送しない。サーバ集計側でも「同一(`visitor_key`, episode, bucket)で各進捗 metric は最大 1」に**冪等化**（distinct 集計）して二重を吸収。
- **idempotency（配送重複）**: beacon は稀に二重配送されうる。生 `analytics_events` は append-only なので重複行は許容し、**Unique/進捗は集計段の distinct で無害化**、絶対数系（`views` 等）は許容誤差とする（best-effort 分析）。厳密 dedup が要る指標のみ集計時に `DISTINCT ON` を使う。

**Unique の定義（確定）**:

> あるバケット（hour/day）・ある軸（novel or episode）における **Unique Readers = distinct `visitor_key` 数**。
> `visitor_key = COALESCE(user_id::text, 'v:' || session_id::text)`。
> `visitor_key` が両方 null のイベント（Cookie 無し・未ログイン）は Unique から除外（view には計上しうるが unique には数えない）。

---

## 4. 集計パイプライン（Aggregation）

### 4.1 全体像

```
analytics.analytics_events        (生・append-only, UUIDv7 で時系列)
        │  HourlyRollupJob        毎時 :05（前 1〜2 時間ぶんを再走査）
        ▼
analytics.analytics_hourly        (bucket_start, novel_id, episode_id, metric, value)
        │  DailyRollupJob         毎日 00:20 UTC（前日ぶん hourly を集約）
        ▼
analytics.analytics_daily         (bucket_date, novel_id, episode_id, metric, value)
        │
        ▼
Dashboard Read Queries            (集計表のみ読む・個人単位を返さない)
```

- 実行主体は **`analytics-worker`** コンテナ（[infrastructure.md](./infrastructure.md) §依存サービス）。web プロセスとは分離し、集計負荷が読書 SSR を圧迫しない。将来はこの worker ごと別サービスへ（PRD §51, §54）。
- スケジュールは worker 内の cron（or `worker` 共有のジョブランナー）。**hourly は毎時、daily は日次、retention は日次**。
- **Realtime（§6.5）は集計表を経由せず** `analytics_events` の直近数分窓を直接クエリ（後述）。

### 4.2 metric カタログ（集計単位）

`analytics_hourly` / `analytics_daily` の `metric` 列に入る値。1 metric = 1 行（`value bigint`）。

| metric | 定義 | 元イベント | 集計方法 | 軸 |
|---|---|---|---|---|
| `views` | 表示回数 | `novel_view` / `episode_view` | count(*) | novel / episode |
| `unique_readers` | 一意読者 | `*_view` | count(distinct `visitor_key`) | novel / episode |
| `read_starts` | 読み始め数 | `episode_read_start` | count(distinct visitor) | episode |
| `progress_25/50/75` | 各到達到達者数 | `episode_progress_*` | count(distinct visitor) | episode |
| `completes` | 読了者数 | `episode_complete` | count(distinct visitor) | episode |
| `reading_time_ms` | 読書時間合計 | `episode_complete`.props.dwell_ms | sum（外れ値クランプ後） | episode |
| `reading_time_n` | 読書時間の母数 | 同上 | count | episode |
| `likes/comments` | Like/Comment 数 | `like`/`comment` | count | episode |
| `stars` / `star_points` | Star 数 / 合計点(1–3) | `star` | count / sum(props.stars) | novel |
| `reviews/follows/library_adds` | 各アクション数 | 対応イベント | count | novel |
| `acq_<src>` | 流入元別セッション数 | `*_view`+referrer/utm 分類 | count(distinct visitor) per source | novel |

> **注意**: `likes/stars/...` の metric は**分析上の観測数**であり、Like/Star の現在値そのものではない（取り消しがある）。Overview に「現在の総 Like 数」を出す場合は social ドメインの正カウンタ（[data-model.md](./data-model.md) social）を参照し、時系列推移だけ本 metric を使う。ダッシュボードでの使い分けは §6.1 に明記。

### 4.3 Hourly Rollup ジョブ

```
HourlyRollupJob（毎時 :05 実行、対象 = 直近 2 時間分のバケット）
 FOR each bucket_hour IN [now-2h, now-1h, now]:   -- 遅延イベント救済のため重ね塗り
   INSERT INTO analytics_hourly (bucket_start, novel_id, episode_id, metric, value)
   SELECT date_trunc('hour', occurred_at), novel_id, target_id_as_episode, metric, agg_value
   FROM analytics_events
   WHERE occurred_at >= bucket_hour AND occurred_at < bucket_hour + 1h
   GROUP BY 1, novel_id, episode_id, metric
   ON CONFLICT (bucket_start, novel_id, episode_id, metric)   -- 冪等 UPSERT
   DO UPDATE SET value = EXCLUDED.value;                      -- 再計算値で置換（加算でなく置換）
```

**設計上のポイント（決定 / 理由）**:

- **置換（re-compute）方式**を採る。`DO UPDATE SET value = EXCLUDED.value`。理由: 遅延イベント・重複配送があっても、対象バケットを**まるごと数え直す**ことで常に正しい値へ収束する（冪等）。加算方式（`value = value + delta`）は二重実行で壊れるため不採用。
- **重ね塗りウィンドウ = 直近 2〜3 時間**。beacon の遅延・時計ずれで前バケットに属すイベントが後から来ても、次回実行が拾い直す。より古い遅延は §4.6 のバックフィルで対応。
- **distinct 系（unique/progress/completes）の再計算コスト**: `visitor_key` の distinct を毎時全走査すると重い。対策として `analytics_events` を `occurred_at` の **BRIN index**＋（将来）**月次パーティション**（[data-model.md](./data-model.md) L613）で走査範囲を絞る。unique はバケット内 distinct なのでバケット単位に閉じて計算できる。
- **一意制約は `COALESCE` 式 unique index**（`novel_id`/`episode_id` が NULL でも一意判定できるよう、data-model.md L627 準拠）。

### 4.4 Daily Rollup ジョブ

```
DailyRollupJob（毎日 00:20 UTC、対象 = 前日）
  加算可能な metric（views/likes/completes/…）:
    daily.value = SUM(hourly.value)  over 24 buckets     -- hourly から集約（軽い）
  distinct 系（unique_readers/progress/…）:
    daily.value = count(distinct visitor_key) を analytics_events から日窓で再計算
    （24 hourly の単純和では visitor の重複を除けないため、生イベントを日粒度で数え直す）
  → analytics_daily に ON CONFLICT UPSERT（置換）
```

- **加算 metric は hourly からロールアップ**（安価）。**distinct metric は生イベントから日窓で再計算**（正確）。「hourly の unique を足すと日次 unique を過大計上する」問題を回避するための明示ルール。
- タイムゾーン: **バケットは UTC 固定**で保存（[data-model.md](./data-model.md) L57）。作者ダッシュボードの「Today/Yesterday」等の日境界は**表示層で作者ロケール（既定 Asia/Tokyo）に変換**して daily を範囲集約する。日次テーブルを UTC で持ち、表示で寄せる（保存を多重化しない）。

### 4.5 遅延・冪等性・再集計の保証

| 課題 | 方針 |
|---|---|
| **遅延イベント** | hourly は直近 2〜3h を毎回重ね塗り。それより古い遅延は日次バックフィル or 手動 reaggregate コマンドで対象日を再計算 |
| **冪等性** | 全 rollup は「対象バケットを数え直して置換」。何度実行しても同結果。ジョブの二重起動・リトライに耐える |
| **再集計（reaggregate）** | 運用コマンド `bun run analytics:reaggregate --from=YYYY-MM-DD --to=…` で範囲指定の hourly→daily を再構築（集計ロジック修正・欠損復旧時） |
| **ジョブ失敗** | rollup は独立・冪等なので、失敗回は次回スケジュールが自然に回復。アラートは worker 監視（[infrastructure.md](./infrastructure.md)）。生イベントは残っているのでデータロスなし |
| **watermark** | 進捗管理が要る場合、`analytics_job_state`（最終成功 bucket）を持ち、そこから重ね塗り幅ぶん遡って再開。ただし冪等なので厳密 watermark は必須でない |

### 4.6 保持期間・パーティション（→ [data-model.md](./data-model.md) 未決 6 / [infrastructure.md](./infrastructure.md)）

- **`analytics_events`（生）**: `occurred_at` で**月次 range パーティション**。ダッシュボードは集計表を読むので、生イベントは集計後は基本参照されない。**保持は既定 90 日**（Realtime＋再集計猶予＋監査に十分）、古いパーティションは `DETACH`→アーカイブ/DROP。
- **`analytics_hourly`**: **保持 90 日**（Episode 詳細の時間別グラフ用）。
- **`analytics_daily`**: **無期限（長期）保持**。作者の長期トレンド・Retention の源泉。行サイズが小さく安価。
- パーティション/保持の具体運用は [infrastructure.md](./infrastructure.md) に委譲。導入時期は生イベント量が閾値を超えた時点（初期は単一テーブルで可）。

---

## 5. ダッシュボード算出定義

すべての Query は **`analytics_daily`/`analytics_hourly`（と Realtime のみ生イベント）だけ**を読む。認可は [auth.md](./auth.md) に従い **Owner/Admin/Writer** のみ（[routing.md](./routing.md) §3.5）。すべて `novel_id` でスコープする。

### 5.1 期間セレクタ（共通, PRD §30）

| ラベル | 範囲（作者ローカル日で解釈） | 参照テーブル |
|---|---|---|
| Today | 当日 00:00〜現在 | daily（当日は hourly 補完可） |
| Yesterday | 前日 1 日 | daily |
| 7 Days | 直近 7 日 | daily |
| 30 Days | 直近 30 日 | daily |
| Custom Range | 任意 from–to | daily |

- 「Today」は当日 daily がまだ確定していないため、**当日ぶんは hourly を合算**して即時性を出す（過去日は daily）。
- 前期間比較（前週比等）は同じ長さの直前期間を daily から引いて算出。

### 5.2 Overview（PRD §30）— `GetAnalyticsOverviewQuery`

Novel 単位。カード指標＋期間内の日次時系列。

| 指標 | 元 metric / データ源 | 式 | 備考 |
|---|---|---|---|
| Page Views | daily `views`(novel + 配下 episode 合算) | Σ value | 作品ページ＋各話表示の合計 |
| Unique Readers | daily `unique_readers`(novel 軸) | Σ日次だと重複 → **期間 unique は生 or 日次上限**（下記注） | 期間全体の distinct は日次和にならない |
| Likes | daily `likes` の期間和（推移）＋ social 正カウンタ（現在値） | Σ / 現在値 | §4.2 注に従い使い分け |
| Stars | daily `stars` / social 正カウンタ | 同上 | 1–3 点。平均点は `star_points/stars` |
| Comments | daily `comments` | Σ | |
| Reviews | daily `reviews` | Σ | |
| Novel Follows | daily `follows`(kind=novel) | Σ（純増は解除考慮、[social-notification.md](./social-notification.md)）| |
| Library Adds | daily `library_adds` | Σ | |

> **期間 Unique Readers の扱い（重要）**: 「7 Days の Unique」は各日 unique の単純和にはならない（同一 visitor が複数日訪問）。方針: **既定は「期間内日次 unique の合計」ではなく、日次 unique の推移グラフ＋"期間 distinct" を別途生イベント（or 日次 HLL）から算出**。初期実装は生イベント distinct（90 日保持内で可能）、高負荷化したら **HyperLogLog スケッチ**を daily に持たせて期間 union する（[未決事項](#9-未決事項)）。

### 5.3 Episode Analytics（PRD §31）— `GetEpisodeAnalyticsQuery`

Episode 単位。

| 指標 | 元 metric | 式 |
|---|---|---|
| Views | `views`(episode) | Σ |
| Unique Readers | `unique_readers`(episode) | 期間 distinct（§5.2 注と同様） |
| **Average Reading Time** | `reading_time_ms`, `reading_time_n` | `Σ reading_time_ms / Σ reading_time_n`（母数 0 は「—」表示） |
| **Completion Rate** | `completes`, `read_starts`(or `unique_readers`) | `completes / max(read_starts, 1)`（分母は "読み始めた人"。0 除算ガード） |
| **Scroll Progress** | `progress_25/50/75`, `completes` | 各しきい値到達者 / `unique_readers`。到達曲線（25→50→75→100）として描画 |
| Likes | `likes` | Σ |
| Comments | `comments` | Σ |

- **Completion Rate の分母は「read_start した人」を第一候補**、無ければ `unique_readers`。到達しきい値ベースの副次指標として `progress_75 到達率` も出す（読了ボタン非押下でも実質読了を捉える）。
- **平均読書時間**は外れ値クランプ済み `reading_time_ms`（§3.3）を使う。中央値が欲しい場合は将来ヒストグラム props を追加（未決）。

### 5.4 Reading Funnel（PRD §32）— `GetReadingFunnelQuery`

Episode 間の読者遷移＝**話をまたいだ離脱ポイントの可視化**。差別化の目玉。

**定義**: Episode 番号順に、各話の到達者数を第 1 話基準の百分率で並べる。

```
step[n] = unique_readers(episode_no = n)              -- episode 軸 unique（期間内）
funnel[n] (%) = round( step[n] / step[1] * 100 )      -- 第1話を 100% とする相対
drop[n]   (%) = funnel[n-1] - funnel[n]               -- 直前話からの離脱
```

| 列 | 定義 | 元 metric |
|---|---|---|
| Episode | 話番号・タイトル | novel 構造（[data-model.md](./data-model.md) episodes） |
| Readers | その話の unique 読者 | `unique_readers`(episode) |
| % of Ep.1 | `step[n]/step[1]` | 上式 |
| Drop from prev | `funnel[n-1]-funnel[n]` | 上式（大きい行を強調表示） |

- **算出は "その話まで到達した unique 読者" ベース**（`episode_view` or `read_start` の distinct visitor）。「離脱」の厳密なコホート追跡（同一 visitor が n 話→n+1 話へ）を精密にやるなら生イベントの visitor 継続を辿る必要があるが、**初期は各話 unique の比**で近似（軽量・PRD §32 の図と一致）。
- **完全コホート版（オプション）**: `next_episode` イベントの `from→to` を使い、「n 話読了者のうち n+1 話へ進んだ割合」を出せる。精度は上がるが計算重め。初期は近似版、詳細ドリルダウンでコホート版（[未決事項](#9-未決事項)）。
- **プライバシー**: 各 step は集計 unique 数のみ。個人の遷移列は出さない（§7）。

### 5.5 Acquisition（PRD §33）— `GetAcquisitionQuery`

流入元別のセッション/読者数。`*_view` イベントの `referrer` と `utm_*`、および内部イベント（`search_click`/`recommendation_click`）から分類。

**分類ルール（優先順）**:

1. `utm_source` があれば **`utm_*` を最優先**（明示キャンペーン）。`source/medium/campaign` 別に集計。
2. 内部イベント: `search_click`→**ReNovel Search**、`recommendation_click`→**ReNovel Recommendation**、内部ランキング経由→**ReNovel Ranking**。
3. `referrer` ホストで外部分類: `google.*`→Google、`x.com`/`twitter.com`→X、既知外部→External Website。
4. `referrer` 空 かつ 内部発でない → **Direct**。

| 流入元カテゴリ | 判定 | metric |
|---|---|---|
| Google | referrer host = google.* | `acq_google` |
| X | referrer host ∈ {x.com, t.co, twitter.com} | `acq_x` |
| Direct | referrer 空・UTM 無・内部発でない | `acq_direct` |
| ReNovel Search | `search_click` | `acq_search` |
| ReNovel Ranking | ランキング経由の view | `acq_ranking` |
| ReNovel Recommendation | `recommendation_click` | `acq_reco` |
| External Website | その他既知外部 host | `acq_external` |
| UTM campaigns | `utm_source/campaign` 別 | 別集計（キャンペーン表） |

- 集計単位は **distinct visitor（セッション）** を基本にし、view 総数も併記。
- **PII 除去**: `referrer` はホスト＋パス概形のみ分類に使い、query string（トークン等 PII を含みうる）は保存前に落とす。`utm_*` は許可長でトリム。

### 5.6 Realtime（PRD §34）— `GetRealtimeReadersQuery`

「今この作品を読んでいる人数」。集計表を経由せず **`analytics_events` の直近短時間窓を直接集計**。

```
window = now() - INTERVAL '5 minutes'          -- 「厳密秒単位でなくてよい」(PRD §34)
active_total = count(distinct visitor_key)
  FROM analytics_events
  WHERE novel_id = :novelId
    AND event_type IN ('episode_view','episode_read_start','episode_progress_25','episode_progress_50','episode_progress_75')
    AND occurred_at >= window
per_episode[episode_id] = count(distinct visitor_key) grouped by episode_id
```

- **island からポーリング**（`GET /api/studio/.../analytics/realtime`、[routing.md](./routing.md) §3.5, [frontend.md](./frontend.md) §1.1）。更新間隔は **15–30 秒**で十分（秒単位不要）。将来 SSE 化余地。
- 直近 5 分窓の生イベント distinct なので**軽量**（`(novel_id, occurred_at)` index で範囲を絞る）。集計 rollup とは独立。
- Episode 別内訳を出す（PRD §34 の例）。**最小母数マスク（§7）は Realtime にも適用**: 人数が k 未満のセルは「<5」等でまるめる。

### 5.7 Retention（PRD §35）— `GetRetentionQuery`

読者の復帰率。**visitor（`session_id`）を cohort キー**にした日次復帰分析。専用ロールアップ `RetentionRollupJob`（日次）で `analytics_daily` とは別の retention 集計表（or daily の metric 拡張）へ書く。

| 指標 | 定義 | 算出 |
|---|---|---|
| Next Day Return | 初訪日 d の visitor のうち d+1 に再訪した割合 | cohort(d) ∩ active(d+1) / |cohort(d)| |
| 7 Day Return | d の visitor が [d+1, d+7] に少なくとも 1 回再訪 | 同上・7 日窓 |
| 30 Day Return | [d+1, d+30] に再訪 | 同上・30 日窓 |
| **新 Episode 公開後の復帰率** | Episode 公開日 e の直前アクティブ読者のうち、[e, e+3] に再訪した割合 | 公開イベント（writing, [writing-revision.md](./writing-revision.md)）× visitor 再訪 |

- cohort は **visitor 単位**（`visitor_key`）。ログイン不要で追える。個人を出さず割合のみ表示（§7）。
- 「新 Episode 公開後の復帰」は、公開時刻（writing ドメインの publish イベント）を基準に、**その作品の既存読者が新話で戻ってきたか**を測る。作者に「新話が休眠読者を呼び戻せたか」を示す差別化指標。
- 実装: retention は生イベントの日次 visitor 集合の交差計算が要るため、**日次で "novel_id × date × visitor set" を集約したワークテーブル**（or daily visitor bitmap/HLL）を持ち、cohort 交差を取る。visitor set の保持は 90 日窓（30 Day Return + 猶予）。

---

## 6. プライバシー保証（PRD §58）— 設計上の担保

> 「誰が何時何分にどこまで読んだ」を作者に出さない（PRD §58）。これを運用ルールでなく**構造で保証**する。

| 保証 | 実装 |
|---|---|
| **集計値のみ露出** | ダッシュボード Query は `analytics_hourly/daily`（＝集計済み）と Realtime の distinct カウントのみ返す。**生 `analytics_events` を作者に見せる API は存在しない**（[routing.md](./routing.md) に個別イベント取得ルートを作らない） |
| **`user_id` を返さない** | `analytics_events.user_id` は Unique 統合の内部キーにのみ使用。DTO・View・chart API のいずれにも user_id / handle / session_id を含めない。Query の SELECT に個人識別列を出さない |
| **最小母数マスク（k-匿名）** | 集計セルの母数が **k（既定 5）未満**なら、その値を `< k` 等にまるめる or 非表示。特に Realtime の episode 別、Acquisition の細分、Funnel 末尾話・Retention コホートなど**少人数で個人が推定されうるセル**に適用 |
| **クエリ語・URL の非保存** | `search_click` はクエリ原文でなく `query_hash`、`referrer` は PII query を除去（§3.5, §5.5） |
| **IP/UA 非保存** | bot 判定に使ったのち破棄。`analytics_events` に残さない（§3.5） |
| **本人履歴との分離** | 読者本人の「続きから読む」履歴は reading ドメインの `reading_progress`（本人閲覧専用、[data-model.md](./data-model.md) L449）にあり、**analytics とは別テーブル・別用途**。作者分析は analytics 集計のみ参照 |

- **最小母数 k は設定値**（既定 5）。Overview のような大母数指標には実質影響せず、粒度の細かい/新規作品の指標でのみ効く。
- これらは Query 層（read 側）で強制する。`AnalyticsReadRepository` の各メソッドが**マスク後の値のみ**返す設計にし、View で誤って生値を出せないようにする。

---

## 7. パフォーマンスと非機能

- **収集ホットパス**: Controller はパース＋202 のみ。novel_id 解決・重複除去はキャッシュ/後段へ寄せ、DB 書き込みは単純 append。読書 SSR と物理プロセス（web）を共有するが、書き込み先スキーマが分離され集計は worker 側（PRD §55）。
- **ダッシュボード**: 集計表を読むだけ・`novel_id` index で絞る・N+1 を作らない（Query 層集約、[frontend.md](./frontend.md) §8）。グラフは island（Analytics Graph）が chart API から JSON を取得（[routing.md](./routing.md) §3.5）。
- **集計負荷分離**: rollup は `analytics-worker`。web の応答時間に影響させない。
- **スケール余地**: 生イベント量増大時は月次パーティション → analytics を別 DB/サービスへ（PRD §51, §54, [architecture.md](./architecture.md) §10）。FK 無し設計がこれを可能にする。

---

## 8. 相互リンク早見

- テーブル定義: [data-model.md](./data-model.md) `analytics` スキーマ（`analytics_events` / `analytics_hourly` / `analytics_daily`）
- ルート・エンドポイント区分: [routing.md](./routing.md) §3.5, §4
- worker・パーティション・保持運用: [infrastructure.md](./infrastructure.md)
- イベント発火元（読書 island・進捗計測）: [reading.md](./reading.md), [frontend.md](./frontend.md) §4.3
- Ranking への素データ供給（unique/completion）: [discovery.md](./discovery.md)
- social 正カウンタ（Like/Star/Follow 現在値）: [social-notification.md](./social-notification.md)
- 認可（Owner/Admin/Writer）: [auth.md](./auth.md)
- 全体像: [architecture.md](./architecture.md) §7

---

## 9. 未決事項

1. **期間 Unique の厳密化**: 7/30 日の期間 distinct を、生イベント再計算のままにするか **HyperLogLog スケッチを `daily` に持たせて union** するか。生イベント保持 90 日と整合を取る。
2. **Reading Funnel のコホート精密版**: `next_episode` ベースの「n話読了→n+1話遷移」精密トラッキングを初期から入れるか、近似（各話 unique 比）に留めドリルダウンで後付けするか。
3. **最小母数 k の値**: 既定 5 で始めるが、Realtime/Retention で表示が過度に潰れないか実データで調整。指標ごとに k を変える余地。
4. **地域/デバイス分析**: PRD にはないが要望が出うる。IP からの粗い地域推定は PII 方針（§3.5）と要調整。現状スコープ外。
5. **`reading_time` の中央値/分布**: 平均だけでなく中央値・ヒストグラムを出すか。props にバケット化した滞在時間を載せる案。
6. **Realtime の配信方式**: ポーリング（15–30s）で開始し、負荷/UX 次第で SSE/WebSocket へ移行するかの判断ライン。
7. **生イベント保持 90 日の妥当性**: 再集計・監査・Retention 30 日窓に対し 90 日で足りるか。長期 Retention 拡張時の見直し。
8. **novel_id 未解決イベントの扱い**: 収集時に episode→novel を解決しきれない場合の後段補完の実装コストと、補完不能イベントの破棄基準。
