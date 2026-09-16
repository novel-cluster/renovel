# Discovery Design / 発見ドメイン設計

> 対象: Discovery ドメイン — Search / Filter / Sort / Ranking / Recommendation / Home。
> 正典は PRD §23, §24, §25, §26, §27, §28, §55。本書は実装に落とすための決定を記す。
> テーブル名・カラム名は [data-model.md](./data-model.md) を正典とし、本書はそれを参照する（命名の再定義はしない）。
> レイヤ・依存方針は [architecture.md](./architecture.md)、画面/island は [frontend.md](./frontend.md)、拡張（`pg_trgm` 等）の有効化は [infrastructure.md](./infrastructure.md) に従う。
> 現状は scaffold（Phase 0 完了）。本書は「これから作る目標形」を示す。

## サマリー

- **日本語全文検索は `pgroonga`（PGroonga）を第一候補として採用**する。理由は N-gram（bi-gram）トークナイザで**分かち書き不要の部分一致・表記ゆれ耐性**を DB 単体で満たし、`LIKE '%...%'` の全走査や標準 `tsvector`(`simple`) の日本語未対応を回避できるため。導入不能な環境向けに **`pg_bigm`（bigram + GIN）へフォールバック**、初期スキャフォルドは既に用意済みの `pg_trgm` で暫定運用できる三段構えとする。
- **検索対象は `novels.title / catchphrase / description`（本体）＋ `users.handle / display_name`（作者）＋ `tags.name / normalized`（タグ）** の 3 ソース。作品本文（Episode body）は初期の検索対象に含めない（PRD §23、コスト/ノイズ回避）。
- **Filter（PRD §24）/ Sort（PRD §25）は Application の Query 層に集約**し、`novels` に denormalize 済みのカウンタ列（`total_char_count / like_count / star_avg / follow_count / published_at / updated_at`）を用いて **N+1 なしの単一クエリ**で解決する（PRD §55）。
- **Ranking（PRD §26）は「時間減衰つき加重スコア」を定期バッチで算出し `ranking_snapshots` に固定**する。素データは `analytics.analytics_daily`（Unique Readers / Completion）と social カウンタ（Likes / Stars / Bookmarks / Follows）から供給し、表示は本表の読み取りのみ（動的計算＋スナップショット併用、[data-model.md](./data-model.md) §3 discovery）。
- **Recommendation 1.0 はルールベース**（同タグ／同作者／人気／新着の混成 + 既読・自作・非公開・ブロックの除外）。スコア式と重みを本書で定義し、将来の協調フィルタ（item-item / matrix factorization）へ差し替え可能な `Recommender` インターフェースで隠蔽する。
- **Home はゲスト／ログインでブロック構成を出し分ける**（PRD §28）。各ブロックは独立した Read Query で、キャッシュ可能なもの（Ranking/New/Completed/Featured）と個人化されるもの（Continue Reading / Followed Updates / Recommendations）を分離する。

---

## 1. Discovery ドメインの位置づけ

Discovery は**読み取り専用（read-side）ドメイン**である。Novel/Social/Analytics が生成した状態を横断的に集約し、検索・並び替え・ランキング・推薦・Home として提示する。書き込み（Like/Star/Follow の登録等）は social ドメインの責務であり、Discovery はそれを消費するだけ。

- **配置**: ユースケースは `application/queries/discovery/`（Read Query）に置く。Discovery 固有のドメインロジック（スコア式・ルール推薦）は `domain/discovery/services/` に純関数として持ち、Drizzle/Context に依存しない（[architecture.md](./architecture.md) §2）。
- **Repository interface** は `domain/discovery/repositories/`（`SearchRepository` / `RankingRepository` / `RecommendationRepository`）、Drizzle 実装は `infrastructure/database/repositories/`。
- **認可**: 検索・一覧・推薦の結果は必ず**公開可視性でフィルタ**する（`visibility='public'` かつ `deleted_at IS NULL` かつ `content_state='visible'`）。Unlisted/Private は検索・ランキング・推薦・Home に**一切出さない**（PRD §9, §56）。認可判定は Query 層で WHERE 句として強制し、UI 任せにしない（[auth.md](./auth.md)）。
- ブロック（`blocks`）した相手の作品は、ログインユーザー向け結果から除外する（[moderation.md](./moderation.md)）。

---

## 2. 日本語全文検索

### 2.1 難所

日本語は英語のように空白で単語分割されない。標準の PostgreSQL 全文検索（`to_tsvector('simple', ...)` / `tsquery`）は**空白区切りトークナイズ**を前提とするため、`simple`/`english` config では日本語文がほぼ 1 トークン化され、部分一致・語中一致が効かない。要件（PRD §23）は「タイトル・キャッチ・あらすじ・ユーザー・タグ」を対象にした実用的な検索であり、以下を満たす必要がある:

- **部分一致 / 語中一致**（「異世界」で「大異世界冒険譚」がヒット）。
- **表記ゆれ耐性**（全半角・大小・カタカナ/ひらがなの正規化）。
- **N+1 を作らない**（PRD §55）。
- **将来、外部検索（OpenSearch 等）へ退避できる**抽象化。

### 2.2 選択肢の比較

| 手段 | 日本語部分一致 | 索引 | 表記ゆれ | 導入コスト | ランキング(関連度) | 備考 |
|---|---|---|---|---|---|---|
| `LIKE '%kw%'` | ○（機能上） | ×（前方 `%` は index 不可 → 全走査） | 手動正規化のみ | 最小 | × | 件数増で線形劣化。初期以外 不可 |
| `tsvector`(`simple`) + GIN | △（トークン境界依存で語中一致弱い） | ○ GIN | 弱 | 小 | ○ `ts_rank` | 日本語分かち書きが標準では無い |
| `tsvector` + 形態素（MeCab 等の外部トークナイザ） | ○（語単位） | ○ GIN | 辞書依存 | 中〜大（辞書運用） | ○ | 新語・固有名で分割ミス。運用重い |
| `pg_trgm` + GIN | △（3-gram、短語 <3 文字が弱い） | ○ GIN | trim/lower 程度 | 小（scaffold 既存） | △ 類似度 `similarity` | 日本語 2 文字語に弱い。暫定運用向き |
| **`pg_bigm` + GIN** | ○（2-gram、2 文字語に強い） | ○ GIN | 手動正規化併用 | 中（拡張導入） | △ | 日本語 LIKE 高速化の定番。関連度は弱い |
| **`pgroonga`（PGroonga）** | **◎（bigram + 正規化トークナイザ）** | ○ 専用 index | **◎（`NormalizerNFKC` 系で全半角/大小/カナ揺れ吸収）** | 中（拡張導入・イメージ選定） | ○ `pgroonga_score` | 日本語検索の実運用実績。多カラム対応 |
| 外部検索（OpenSearch 等） | ◎ | ◎ | ◎ | 大（別コンポーネント） | ◎ | 1.0 では過剰。将来退避先 |

### 2.3 決定 / 理由 / 代替案

| | 内容 |
|---|---|
| **決定** | 日本語全文検索は **PGroonga** を第一候補として採用する。`novels`（title/catchphrase/description）と `users`（handle/display_name）と `tags`（name/normalized）に PGroonga index を張り、bigram トークナイザ + NFKC 正規化で検索する。**導入不能・不安定な環境向けに `pg_bigm` をフォールバック**とし、**scaffold 段階の暫定は既存の `pg_trgm`** で動かす。実装はどの手段でも同じ `SearchRepository` interface の裏に隠す。 |
| **理由** | ① PGroonga は **bigram + 正規化**で「分かち書き不要の部分一致」「全半角・大小・カナ揺れ吸収」を **DB 単体**で満たし、形態素辞書の運用負荷が無い。② `LIKE` 全走査（線形劣化）と `tsvector('simple')`（日本語語中一致が弱い）の両欠点を回避。③ 複数カラム・複数テーブルを同一機構で扱え、`pgroonga_score()` で関連度ソートも可能。④ Repository で隠蔽するため、将来 OpenSearch へ移す際も呼び出し側（Query 層）は不変。 |
| **代替案** | (a) **形態素解析（MeCab + tsvector）** — 語単位で精度は高いが、新語・固有名詞の分割ミスと辞書更新運用が重く、1.0 の規模には過剰。将来関連度品質が要件化したら再検討。(b) **pg_bigm 単体** — PGroonga と同じ 2-gram で LIKE を高速化できるが、正規化（カナ揺れ等）を自前 SQL で持つ必要があり、関連度スコアが弱い。**フォールバックとして採用**。(c) **外部検索エンジン** — 品質最上だが別サービス運用が必要。**将来の退避先**として §2.8 に接続点だけ用意。 |

### 2.4 対象フィールドと正規化

| ソーステーブル | 対象カラム | 正規化前処理 | 重み（関連度） |
|---|---|---|---|
| `novels` | `title` | NFKC + lower + trim | 最高（A） |
| `novels` | `catchphrase` | 同上 | 高（B） |
| `novels` | `description` | 同上 | 中（C） |
| `users` | `display_name`, `handle` | 同上（handle は小文字保存済み） | 高（作者検索時） |
| `tags` | `name`, `normalized` | `normalized` は data-model 定義の正規化キー（小文字/trim/全半角統一） | 完全一致優先 |

- 検索クエリ文字列も**同じ NFKC + lower + trim** を Application 側で適用してから投げる（表記ゆれの左右対称性）。
- **タグ検索は 2 段**: まず `tags.normalized` で完全一致 → 該当タグの `novel_tags` から Novel を引く。部分一致タグ候補は PGroonga で `tags.name` を検索。
- 検索モードは UI で切替（[frontend.md](./frontend.md) の Search Filter island）: `all`（本体横断）/ `author`（作者名）/ `tag`（タグ）。既定は `all`。

### 2.5 インデックス設計

PGroonga 採用時（第一候補）:

```sql
-- 拡張（有効化タイミングは infrastructure.md に集約）
CREATE EXTENSION IF NOT EXISTS pgroonga;

-- Novel 本体: 3 カラムを 1 つの複合 PGroonga index にまとめる
CREATE INDEX novels_pgroonga_idx
  ON novels
  USING pgroonga (title, catchphrase, description)
  WHERE deleted_at IS NULL AND visibility = 'public' AND content_state = 'visible';

-- 作者
CREATE INDEX users_pgroonga_idx
  ON users USING pgroonga (display_name, handle)
  WHERE deleted_at IS NULL;

-- タグ
CREATE INDEX tags_pgroonga_idx ON tags USING pgroonga (name);
```

- **部分 index**: 公開・生存・可視の作品だけを索引化し、index を小さく保つ（非公開は検索対象外なので索引不要）。
- PGroonga の正規化は index 定義で `WITH (tokenizer='TokenBigram', normalizers='NormalizerNFKC150')` 相当を指定（バージョン差は infrastructure 側で吸収）。

フォールバック `pg_bigm` の場合:

```sql
CREATE EXTENSION IF NOT EXISTS pg_bigm;
CREATE INDEX novels_bigm_title_idx ON novels USING gin (title gin_bigm_ops)
  WHERE deleted_at IS NULL AND visibility='public' AND content_state='visible';
-- catchphrase / description も同様。検索は LIKE '%kw%' が bigram index を使う
```

暫定 `pg_trgm`（scaffold 既存、[data-model.md](./data-model.md) §1.5）の場合は `gin_trgm_ops` + `ILIKE` / `similarity()`。**いずれも `SearchRepository` の実装差分にとどめる**。

### 2.6 表記ゆれ・部分一致・N-gram の扱い

- **部分一致**: bigram（PGroonga / pg_bigm）は語中一致を index で高速化する。2 文字未満のクエリ（1 文字）は N-gram が張れないため、`tags`/`title` 前方一致のみに縮退させ、全走査を避ける（1 文字検索は候補提示に留める）。
- **表記ゆれ**: NFKC 正規化で全角/半角・互換文字・大小を吸収。カタカナ⇄ひらがなの相互ヒットは NormalizerNFKC では吸収されないため、**必要なら将来カナ畳み込み用の派生列**（`title_kana_norm` 等）を追加する（§7 未決事項）。
- **関連度**: PGroonga は `pgroonga_score(tableoid, ctid)` で近似スコアを返す。ソート `Rating`/`Popular` と競合しないよう、**検索の既定ソートは「関連度 desc → 更新日時 desc」**、明示ソート指定時はそれを優先（§3）。

### 2.7 検索クエリの流れ（N+1 回避）

```
GET /search?q=...&mode=all&genre=...&status=ongoing&sort=popular&page=n
  → SearchController（入力 parse + 認証コンテキスト）
  → SearchNovelsQuery（Application/queries/discovery）
      1. 正規化した q を SearchRepository.searchNovelIds(q, filters, sort, page)
         → 単一 SQL: PGroonga 述語 + filter(WHERE) + sort(ORDER BY) + LIMIT/OFFSET
            返すのは novel_id と関連度スコアのみ
      2. 同 SQL の SELECT で novels の denormalize 列も同時取得（追加ラウンドトリップ無し）
      3. 作者名・タグは JOIN もしくは in-clause の 1 回のバッチ取得（N+1 回避）
  → SearchResultsView（SSR, hono/jsx）
```

- **一覧カードに必要な値（タイトル/作者/カウンタ/更新日）は 1 クエリ + 1 バッチで揃える**。作品ごとに `COUNT` を撃たない（`novels` のカウンタ列を使う、[data-model.md](./data-model.md) §4 の N+1 回避方針）。
- ページングは初期 `LIMIT/OFFSET`。深いページで OFFSET が重くなる場合は keyset（`(sort_key, id)` カーソル）へ移行（§7 未決事項）。

### 2.8 外部検索への退避余地

将来アクセス増・関連度品質要件が上がった場合に OpenSearch/Meilisearch 等へ移せるよう、以下を最初から守る:

- 呼び出し側は `SearchRepository` interface のみに依存（`searchNovels(query): Promise<SearchHit[]>`）。SQL/PGroonga はその実装詳細。
- 検索対象の**インデックス投入イベント**を意識する: Novel の作成/更新/公開/削除時に「検索索引更新」を分離可能なフックにしておく（初期は index 同期が自動なので no-op、外部検索導入時に投入 worker を挿す）。[architecture.md](./architecture.md) §10 のスケール余地（`worker` 追加）と接続。
- Compose に後から `opensearch` を足せる前提（[infrastructure.md](./infrastructure.md)）。

---

## 3. Filter / Sort（PRD §24, §25）

### 3.1 Filter 項目とクエリ設計

| Filter（PRD §24） | 対象カラム / 表 | 述語 | index |
|---|---|---|---|
| Genre | `novels.genre` | `= :genre` | `idx(genre)` |
| Tags | `novel_tags.tag_id`（`tags.normalized` 経由で解決） | `EXISTS`/`IN`。複数タグは AND（全含有）を既定、OR も選択可 | `idx(tag_id, novel_id)` |
| Ongoing | `novels.publication_status` | `= 'ongoing'` | `idx(visibility, publication_status, ...)` |
| Completed | `novels.publication_status` | `= 'completed'` | 同上 |
| Word Count | `novels.total_char_count` | 範囲 `BETWEEN :min AND :max`（帯: 〜1万/1〜5万/5〜10万/10万〜） | `idx(total_char_count)`（必要時追加） |
| Updated At | `novels.updated_at` | `>= now() - :window`（24h/7d/30d） | `idx(updated_at DESC) WHERE visibility='public'` |

常時付与される**ベース述語**（認可）: `visibility='public' AND deleted_at IS NULL AND content_state='visible'`。

- 複数タグ AND は「該当タグ数 = 指定数」を満たす Novel に絞る集約で表現:
  ```sql
  SELECT nt.novel_id
  FROM novel_tags nt
  WHERE nt.tag_id = ANY(:tagIds)
  GROUP BY nt.novel_id
  HAVING count(*) = :tagCount   -- AND。OR の場合は HAVING を外す
  ```
  これを `novels` へ JOIN。タグ絞りと本体フィルタを**1 クエリ**にまとめて N+1 を避ける。

### 3.2 Sort 項目とクエリ設計

| Sort（PRD §25） | ORDER BY | 供給元 | index |
|---|---|---|---|
| Popular | `ranking_snapshots.score DESC`（当該 period）or フォールバック `like_count DESC` | ranking / social カウンタ | `idx(period,bucket_date,rank)` |
| New | `published_at DESC` | `novels.published_at` | `idx(...published_at DESC)` |
| Recently Updated | `updated_at DESC` | `novels.updated_at` | `idx(updated_at DESC)` |
| Rating | `star_avg DESC, star_count DESC` | `novels.star_avg/star_count` | `idx(star_avg)`（必要時） |
| Word Count | `total_char_count DESC` | `novels.total_char_count` | `idx(total_char_count)` |

- **タイブレークは常に `id DESC`（UUIDv7 の時系列性で新しい順）**を末尾に付け、安定順序・keyset 移行の布石にする。
- 「Popular」はランキングスコアと自然に整合させるため、検索の Popular ソートは可能なら直近 `weekly` の `ranking_snapshots` を JOIN する。スナップショット未生成の新作は末尾フォールバック（`like_count`）。
- **Rating の公平性**: `star_count` が極端に少ない作品が上位化しないよう、ベイズ平均（§4.5 と同方式）でスコア化するオプションを持つ（既定はそのまま `star_avg`、しきい値運用は §7 未決事項）。
- すべての Filter/Sort は `application/queries/discovery/ListNovelsQuery` に集約し、**フィルタ条件のホワイトリスト検証**（不正カラム/方向を弾く）を Application 層で行う。

---

## 4. Ranking（PRD §26）

### 4.1 提供ランキング

`Daily` / `Weekly` / `Monthly` / `New` / `Completed`（`ranking_snapshots.period` に対応）。

- **New**: スコア計算せず `published_at DESC`（公開新着）。
- **Completed**: `publication_status='completed'` を対象に、完結作の中で加重スコア降順（完結した名作の再発見）。
- **Daily/Weekly/Monthly**: 下記の**時間減衰つき加重スコア**で算出。

### 4.2 スコアで使う素データ（PRD §26 のシグナル）

| シグナル | 供給元 | 備考 |
|---|---|---|
| Unique Readers | `analytics.analytics_daily`（metric=`unique_readers`） | 個人特定はしない集計値（PRD §58, [analytics.md](./analytics.md)） |
| Reading Completion | `analytics.analytics_daily`（metric=`completes` / `episode_view` 比） | 完読率。読了イベント由来 |
| Likes | `likes`（期間内増分）or `novels.like_count` の差分 | Episode Like を Novel へ集約 |
| Stars | `stars`（期間内増分）/ `novels.star_count` | |
| Bookmarks | `library_entries`（期間内増分, state=read_later/favorite 等） | PRD の "Bookmarks" は Library 追加 |
| Novel Follows | `novel_follows`（期間内増分）/ `novels.follow_count` | |

> 「期間内増分」は各社会的イベントの発生時刻を用いる。social 表自体は発生時刻（`created_at`）を持つため、期間 `[t0, t1)` の件数を集計できる。Unique Readers/Completion は `analytics_daily` の日次バケットを期間で合算。

### 4.3 時間減衰つき加重スコア（定義）

作品 `n`、集計基準時刻 `T`（バッチ実行時刻）に対し:

```
score(n, T) = Σ_e [ w_e · count_e(n, window) ] · recency(n, T)
```

- `e` はシグナル種別（unique_readers, completion, like, star, bookmark, follow）。
- `count_e(n, window)` は当該 period の window（Daily=24h, Weekly=7d, Monthly=30d）内のシグナル量。
- `w_e` は重み（§4.4）。
- `recency(n, T)` は**作品の勢い減衰係数**（新しいアクティビティほど高い）。イベント個別に減衰させる方式（下記）と、作品単位の代表時刻で減衰させる方式の 2 段で定義する。

**(A) イベント時間減衰（推奨・精密）** — 各シグナル発生を指数減衰で重み付け:

```
weighted_e(n) = Σ_{i ∈ events_e(n, window)} exp( -λ_period · age_i )
age_i = (T - occurred_at_i) を「時間」単位（Daily）/「日」単位（Weekly/Monthly）で計測
```

半減期 `H`（そのシグナルが半分の価値になる経過時間）から `λ = ln(2) / H`。

| period | window | 減衰の time unit | 半減期 H（既定） | λ = ln2/H |
|---|---|---|---|---|
| Daily | 24h | 時間 | 12h | 0.0578 /h |
| Weekly | 7d | 日 | 3.5d | 0.198 /d |
| Monthly | 30d | 日 | 15d | 0.0462 /d |

```
score_A(n) = Σ_e [ w_e · Σ_i exp(-λ_period · age_i) ]
```

**(B) 集計簡易版（Unique Readers/Completion 等、イベント粒度を持たない集計値向け）** — 日次バケット `d` に減衰を掛けて合算:

```
score_B(n) = Σ_e w_e · Σ_{d ∈ window} value_e(n, d) · exp(-λ_period · age_days(d))
```

**実装採用**: like/star/follow/bookmark は行に `created_at` があるため **(A)**、unique_readers/completion は `analytics_daily` の日次値なので **(B)**。両者を合算して最終 `score`。

### 4.4 重み `w_e`（初期値・調整可能）

「軽い関与ほど数は多いが価値は低い」原則で設定。設定値は `ranking_config`（定数 or 環境設定）に持ち、コード直書きしない。

| シグナル | 重み `w_e`（初期） | 根拠 |
|---|---|---|
| Reading Completion（読了） | 5.0 | 最も強い満足シグナル |
| Star | 4.0 | 明示的評価（1–3、value も加味可） |
| Novel Follow | 3.0 | 継続購読意思 |
| Bookmark（Library 追加） | 2.5 | 後で読む/お気に入り |
| Like | 1.5 | 軽い好意（Episode 単位で数が多い） |
| Unique Readers | 1.0 | 到達量。PV 単独偏重を避けるため低め |

- Star は評価値を反映するなら `w_star · (value/3)` 等でスケール（既定は件数ベース、value 加味は §7 未決事項）。
- 累積 PV のみで決めない（PRD §26）ため、`novel_view` の生 PV はスコアに**直接は入れない**（Unique Readers を採用）。

### 4.5 品質補正（少数バイアス対策・任意）

`Completed`/`Rating` 系や小規模作品の暴れを抑えるため、必要に応じてベイズ補正を掛ける:

```
completion_rate_bayes(n) = (C · m + completes(n)) / (C · 1 + reads(n))
  C = 事前サンプル数（例 20）, m = 全体平均完読率
```

初期の Daily/Weekly/Monthly は件数ベースで開始し、上位が薄い作品で荒れる場合に導入する（§7 未決事項）。

### 4.6 集計タイミングと保存

| period | バッチ間隔 | bucket_date | 保存 |
|---|---|---|---|
| Daily | 1 時間ごと再計算（当日分を更新） | 当日 | `ranking_snapshots(period='daily')` |
| Weekly | 1 時間〜数時間ごと | 週代表日（当日） | `period='weekly'` |
| Monthly | 数時間〜日次 | 月代表日 | `period='monthly'` |
| New | 動的（`published_at DESC`、スナップ不要） | — | クエリ直 or 軽量キャッシュ |
| Completed | 日次 | 当日 | `period='completed'` |

- **決定 / 理由 / 代替案**: ランキングは**定期バッチでスコア算出 → `ranking_snapshots` へ upsert し、表示は本表の読み取りのみ**（[data-model.md](./data-model.md) §3 discovery の決定に一致）。理由は毎リクエスト算出が重く N+1 リスク（PRD §55）である一方、多少の遅延は許容できるため。代替は (a) 完全動的（負荷過大）、(b) マテビュー（更新粒度と減衰の再計算制御がしにくい）で不採用。
- **冪等な upsert**: `UNIQUE(period, bucket_date, novel_id)` に対し `ON CONFLICT ... DO UPDATE SET score, rank`。rank は score 降順の `row_number()` で確定。
- **実行主体**: 初期は Bun のスケジュール（アプリ内 interval / 起動時ジョブ）で可。将来 `analytics-worker` / `worker` へ分離（[architecture.md](./architecture.md) §10, [infrastructure.md](./infrastructure.md)）。イベント収集をブロックしない（PRD §55）。
- **表示**: `GET /ranking/:period` は `SELECT ... FROM ranking_snapshots JOIN novels ... WHERE period=:p AND bucket_date=:latest ORDER BY rank LIMIT n`。Novel カード情報は JOIN で 1 クエリ取得（N+1 回避）。

### 4.7 バッチ擬似コード

```
for period in [daily, weekly, monthly, completed]:
  window = windowOf(period); λ = ln2 / halfLife(period)
  candidates = novels where visibility='public' and deleted_at is null
               and content_state='visible'
               and (period != completed or publication_status='completed')
  for n in candidates:
     sA = Σ_e w_e · Σ_i exp(-λ · age(event_i))         # like/star/follow/bookmark
     sB = Σ_e w_e · Σ_d value_e(n,d) · exp(-λ · age(d)) # unique_readers/completion
     score[n] = sA + sB
  ranked = sort(score desc, id desc)
  upsert ranking_snapshots(period, today, novel_id, rank, score)
```

---

## 5. Recommendation（PRD §27）

### 5.1 方針

1.0 は**ルールベース**（PRD §27）。ユーザーの Signals（Read History / Completed / Likes / Stars / Library / Follow / Tags / Genres）から**嗜好プロファイル**を作り、候補を混成して並べる。実装は `domain/discovery/services/recommender.ts` の純ロジック + `RecommendationRepository`（候補取得）に分離し、将来の協調フィルタへ**インターフェース互換で差し替え**られるようにする。

### 5.2 嗜好プロファイル

ログインユーザー `u` について、直近の行動から重みつきタグ/ジャンル/作者の嗜好ベクトルを作る:

```
tagPref[t]   = Σ_{行動 a に紐づく Novel が tag t を持つ} weight(a)
genrePref[g] = 同様
authorPref[k]= 同様（作者 k）
weight(a): completed=5, star=4(value 反映可), follow=3, library=2.5, like=1.5, read=1
```

- 行動元 Novel は `reading_progress` / `library_entries` / `likes`(→episode→novel) / `stars` / `novel_follows` / `user_follows`(→作者作) から取得。
- 直近性: 古い行動は減衰（§4 と同じ指数減衰、半減期 30d 目安）。

### 5.3 候補生成ルール（混成）

| ルール | 内容 | 供給 | 既定配分 |
|---|---|---|---|
| R1 同タグ | `tagPref` 上位タグを持つ未読 Novel | `novel_tags` | 40% |
| R2 同作者 / フォロー作者 | `authorPref` 上位・`user_follows` 対象作者の他作 | `novels.author_id` | 15% |
| R3 人気（嗜好ジャンル内） | `genrePref` 内で `ranking_snapshots(weekly)` 上位 | ranking | 25% |
| R4 新着（嗜好内） | `genrePref`/`tagPref` に合致する直近公開作 | `novels.published_at` | 10% |
| R5 全体人気（多様性/コールドスタート） | プロファイルに依らない weekly 上位 | ranking | 10% |

- **スコア融合**: 候補 Novel `c` のスコア
  ```
  rec(c) = Σ_t (tagPref[t]·has_tag(c,t)) + α·genrePref[genre(c)]
           + β·authorPref[author(c)] + γ·popularity(c) + δ·recency(c)
  α=1.0, β=1.5, γ=0.6, δ=0.4（初期値・調整可）
  ```
- **多様性**: 同一作者・同一タグの連続を抑える（上位 N 件で作者/タグの出現上限を設ける、MMR 風の簡易 re-rank）。

### 5.4 除外・認可フィルタ（必須）

推薦候補から必ず除外:

- 既読/対応済み: `reading_progress` / `library_entries` に存在する Novel（「もう知っている」）。
- 自作: `author_id = u` および `collaborators` で関与する Novel。
- 非公開・削除・Hide: `visibility != 'public'` / `deleted_at` / `content_state='hidden'`。
- ブロック相手の作品（`blocks`）、Content Warning 設定でオプトアウトしているもの（[moderation.md](./moderation.md)）。

### 5.5 ゲスト / コールドスタート

- 未ログイン or 行動履歴が薄いユーザーは **R5（全体人気 weekly）＋ New＋Featured** に縮退（プロファイルが作れないため）。Home の該当ブロックと共有（§6）。
- 少量履歴（数件）では R1/R2 の重みを下げ、R3/R5 の比率を上げる。

### 5.6 決定 / 理由 / 代替案

| | 内容 |
|---|---|
| **決定** | 1.0 は上記ルールベース混成 + 除外フィルタ + 簡易多様性 re-rank。`Recommender` interface（`recommend(userId, limit): NovelId[]`）で隠蔽。 |
| **理由** | 学習データ・実装コストなしで即運用でき、PRD §27 の Signals を直接反映できる。除外/認可を Query 層で強制でき安全。 |
| **代替案** | (a) 協調フィルタ（item-item 類似・行列分解）— データ蓄積後に効果大だが、初期はデータ不足でコールドスタートに弱い。**将来**、`recommend` 実装を差し替えて導入（オフライン計算 → `recommendation_candidates` 集計表を追加）。(b) 埋め込みベクトル + ANN — さらに将来。interface を保てば移行可能。 |

---

## 6. Home（PRD §28）

### 6.1 ブロック構成（出し分け）

| ブロック | ゲスト | ログイン | 供給 | 個人化 | キャッシュ |
|---|---|---|---|---|---|
| Continue Reading | — | ○ | `reading_progress`（user_id, last_read_at DESC） | 個人 | 不可（本人のみ） |
| Followed Novel Updates | — | ○ | `novel_follows` × `episodes.published_at`（フォロー作の新着話） | 個人 | 不可 |
| Recommendations | — | ○ | §5 Recommender | 個人 | 短期（ユーザー別） |
| Weekly Ranking | — | ○ | `ranking_snapshots(weekly)` | 共通 | 可（全ユーザー共通） |
| Ranking | ○ | （Weekly に置換） | `ranking_snapshots` | 共通 | 可 |
| New Novels | ○ | ○ | `novels.published_at DESC` | 共通 | 可（短期） |
| Completed Novels | ○ | ○ | `ranking_snapshots(completed)` or 完結新着 | 共通 | 可 |
| Featured Novels | ○ | —（任意で表示可） | 運営キュレーション（後述） | 共通 | 可 |

- **ゲスト**: Ranking / New / Completed / Featured（PRD §28）。
- **ログイン**: Continue Reading / Followed Updates / Recommendations / Weekly Ranking / New / Completed（PRD §28）。

### 6.2 実装方針

- 各ブロックは**独立した Read Query**（`application/queries/discovery/home/*`）。Home コントローラは並列に呼び出し、SSR で組み立て（[architecture.md](./architecture.md) §5.2）。
- **共通ブロック（Ranking/New/Completed/Featured）はプロセス内 or Redis 短期キャッシュ**（将来 `redis` 追加、[infrastructure.md](./infrastructure.md)）。個人化ブロックはキャッシュしない or ユーザー別短 TTL。
- 各カードは `novels` の denormalize 列で完結させ、ブロックごとに 1 クエリ（+ タグ/作者バッチ）で N+1 を避ける（PRD §55）。
- **Featured** は当面「運営が選ぶ」キュレーション。初期実装は環境設定/管理フラグ（`novels.is_featured` 相当）か軽量な `featured_novels(novel_id, order, period)` 表を追加（§7 未決事項。data-model には未定義のため導入時に [data-model.md](./data-model.md) を先に更新）。

---

## 7. 未決事項

1. **PGroonga のコンテナ運用**: PGroonga 入り Postgres イメージの選定・ビルド、`pg_bigm` フォールバックの切替方針は [infrastructure.md](./infrastructure.md) と要調整（拡張有効化タイミング含む）。
2. **カナ揺れ（カタカナ⇄ひらがな）吸収**: NormalizerNFKC では吸収されない。派生正規化列 or PGroonga の追加ノーマライザ導入可否。
3. **深いページングの keyset 化**: `LIMIT/OFFSET` の劣化点で `(sort_key, id)` カーソルへ移行するしきい値。
4. **Ranking の重み・半減期のチューニング**: 初期値（§4.4/§4.3）は仮。実データで A/B・観測して調整。`ranking_config` の管理形態（環境変数 or 設定表）。
5. **Star value のスコア反映**: 件数ベースか value 加重か（§4.4, §5.2）。[social-notification.md](./social-notification.md) の Review/Star 整合方針と連動。
6. **Rating ソート/Completed の少数バイアス補正**（ベイズ平均）のしきい値 `C` と全体平均 `m` の運用。
7. **Genre の管理形態**: 固定 enum か `genres` マスタ表か（[data-model.md](./data-model.md) 未決事項 2 と共通）。フィルタ UI の選択肢供給に影響。
8. **Recommendation の協調フィルタ移行**: オフライン計算の置き場（`recommendation_candidates` 集計表）と再計算間隔。
9. **Featured の管理**: `novels.is_featured` か `featured_novels` 表か。導入時に [data-model.md](./data-model.md) を更新。
10. **検索の関連度品質**: bigram で不足する場合の形態素解析 / 外部検索（OpenSearch）への切替判断基準（§2.8）。
