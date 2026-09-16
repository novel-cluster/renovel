# Reading / 読書ドメイン設計

読書体験を支える永続データ（Reading Progress・Library）と、Reader Settings の同期方式・プライバシー方針を定義する。UI/CSS の詳細（フォント・行間・縦書き等の見た目）は [frontend.md](../overview/frontend.md) §4 が担当し、本書はデータモデル・更新ロジック・同期・プライバシーに専念する。テーブル定義の正典は [data-model.md](../foundation/data-model.md)。

## サマリー

- Reading Progress は **Episode 単位**（`UNIQUE(user_id, episode_id)`）で記録し、「続きから読む」は `novel_id` で絞った `last_read_at DESC` の 1 件解決とする。位置は**段落 index**で表現し、文字オフセットは採用しない（記法変換・エディタ差分に強いため）。
- 進捗の永続化は **Analytics イベント送信とは別チャネル**の非ブロッキング API（`POST /api/episodes/{episodeId}/reading-progress`）で行い、失敗しても本文閲覧を止めない。クライアントは間引き（debounce）とページ離脱時（`visibilitychange`/`pagehide`）フラッシュで送信回数を抑える。
- ゲスト（未ログイン）は `reading_progress` に一切記録しない。「続きから読む」はログインユーザー限定機能とし、ゲストには localStorage ベースの簡易「最後に開いた Episode」のみ提供する（サーバ非同期・プライバシー影響なし）。
- Library は `library_entries`（`UNIQUE(user_id, novel_id)` 1 レコード = 1 状態）で管理し、自動遷移は「読了 → 明示操作がない限り自動で `completed` にはしない」を既定とする（理由は §3）。
- Reader Settings は **localStorage を正**とし、ログイン時のみサーバ（`users` 拡張カラム or 専用テーブル）へ非同期バックアップする二層構成。FOUC 回避は cookie ミラーで行う。
- プライバシー（PRD §58）: `reading_progress` は本人以外に一切公開しない。作者・Collaborator・他ユーザー向け API/画面には個人の既読状況を絶対に含めない。集計は [analytics.md](./analytics.md) の `analytics_events`/`analytics_daily` 経由のみ。

---

## 1. Reading Progress（PRD §18）

### 1.1 記録項目とテーブル

正典は [data-model.md](../foundation/data-model.md) `reading_progress`。再掲:

| カラム | 型 | 意味 |
|---|---|---|
| `user_id` | uuid | 本人 |
| `novel_id` | uuid | 「続きから読む」を Novel 単位で引くための denormalize |
| `episode_id` | uuid | 最後に読んだ Episode |
| `position` | integer | 本文内の読書位置（§1.2） |
| `is_completed` | boolean | この Episode を読了したか |
| `last_read_at` | timestamptz | 最終閲覧日時 |

一意制約 `UNIQUE(user_id, episode_id)` により、**Episode ごとに 1 行**を保持する（同じ Episode を読み返しても upsert）。PRD §18 が求める4項目（最後に読んだ Episode／位置／読了済み Episode／最終閲覧日時）は以下のように表現する。

| PRD の記録項目 | 実装上の表現 |
|---|---|
| 最後に読んだ Episode | `reading_progress` を `novel_id` で絞り `last_read_at DESC LIMIT 1` した行の `episode_id` |
| 最後に読んだ位置 | その行の `position` |
| 読了済み Episode | `is_completed = true` の行の集合（`SELECT episode_id FROM reading_progress WHERE user_id=? AND novel_id=? AND is_completed`） |
| 最終閲覧日時 | 各行の `last_read_at`（Novel 全体の最終閲覧は該当行の MAX） |

### 1.2 位置の表現: 段落 index を採用

**決定**: `position` は「本文を段落（改行区切りブロック）に分割した配列の index」とする。スクロール割合（0.0–1.0）や文字オフセットは採用しない。

- **理由**:
  - 文字オフセットは Episode 本文が改訂（`episode_revisions`、[writing-revision.md](./writing-revision.md)）で編集されるとズレる。段落 index は加筆・修正があっても「だいたい同じ段落」に復元しやすい。
  - スクロール割合はビューポート幅・フォントサイズ・Reader Settings（Content Width, Vertical/Horizontal）で見た目上の位置が変わり、デバイスをまたぐと不正確。段落 index はレイアウト非依存。
  - ルビ・傍点タグ（[text-notation.md](./text-notation.md)）が展開されても段落境界（`\n\n`）は変わらないため、記法変換後の DOM でも段落単位のスクロール復元が可能（各段落に `data-p="{index}"` を振り、`scrollIntoView` する）。
- **代替案**（不採用）: (a) 文字オフセット — 改訂に弱い。(b) スクロール割合 — デバイス非依存性がない。(c) 見出し/シーン区切り単位 — Episode 内にシーン区切りが必ずあるとは限らず粒度が粗すぎる。
- **読了判定**: 最終段落（`position >= paragraphCount - 1`）まで到達、または明示的な「読了」操作（Analytics の `episode_complete` と同一トリガー、§1.4）で `is_completed = true` に更新。

### 1.3 「続きから読む」解決ロジック

`GET /@{handle}/{slug}/continue`（[routing.md](../foundation/routing.md) §3.2）の解決アルゴリズム:

```text
ResumeReadingService.resolve(userId, novelId):
  1. row = SELECT * FROM reading_progress
            WHERE user_id = userId AND novel_id = novelId
            ORDER BY last_read_at DESC
            LIMIT 1
  2. if row is null:
       → 最初の Episode（episode_no = 1、Visibility/Draft チェック通過分のうち先頭）へ
  3. else if row.is_completed かつ 次の Episode が存在する:
       → 次の Episode（episode_no = row.episode.episode_no + 1）の先頭へ
       # 「最後まで読み切った回」を再度開かせない
  4. else:
       → row.episode へ、position（段落 index）を渡してスクロール復元
  5. 対象 Episode が Private/Draft で本人に閲覧権限がない場合（Collaborator 降格・Episode 削除等）:
       → 直近で閲覧可能な最新 Episode にフォールバック、無ければ Novel トップへ
```

- 認可: 本人の `reading_progress` のみ参照（[routing.md](../foundation/routing.md) 3.2 に準拠）。他ユーザーの進捗からは解決しない。
- 未ログイン時、`/continue` へのアクセスは Novel トップ（`/@{handle}/{slug}`）へリダイレクト（要ログイン扱い、routing.md 通り）。

### 1.4 更新頻度と Analytics との連携（非ブロッキング）

Reading Progress の永続化と Analytics イベント送信は**目的も送信先も別**だが、クライアント側のトリガーは共有する。

| トリガー | Reading Progress 更新 | Analytics イベント |
|---|---|---|
| Episode 読了ページ到達 | `episode_id` upsert、`position=0` | `episode_view` |
| 読書開始（本文スクロール検知） | — | `episode_read_start` |
| 段落 25/50/75% 到達 | `position` 更新（間引き後） | `episode_progress_25/50/75` |
| 最終段落到達 or 明示読了操作 | `is_completed=true` | `episode_complete` |
| ページ離脱（`pagehide`/`visibilitychange: hidden`） | 直近位置を最終フラッシュ | （該当イベントがあれば同時送信） |

- **非ブロッキング**: どちらの送信も `navigator.sendBeacon`（対応環境）または `fetch(..., { keepalive: true })` を用い、失敗・遅延しても本文描画・ページ遷移をブロックしない。architecture.md §7 の「Analytics 送信は非ブロッキング」方針を Reading Progress にも適用する。
- **間引き**: クライアントは `position` の変化を都度送らず、(a) 段落境界を跨いだ時、(b) 3〜5秒に1回以上は送らない debounce、(c) 離脱時フラッシュ、の3条件でまとめる。サーバは `UPDATE ... WHERE last_read_at < now()` のような単純 upsert（`ON CONFLICT (user_id, episode_id) DO UPDATE`）で十分——書き込み頻度が低いため楽観ロック等は不要。
- **エンドポイント分離**: `POST /api/episodes/{episodeId}/reading-progress`（本表の対象、DB 永続化）と Analytics Endpoint（`analytics_events` 追記、[analytics.md](./analytics.md)）は別 Controller・別テーブル。1回のクライアント送信で両方叩く場合も、Application Service を分けて呼び出し、片方の失敗が他方をブロックしないようにする（例: `Promise.allSettled` 相当、またはそもそも別リクエストにして独立させる）。

### 1.5 ゲスト（未ログイン）時の扱い

**決定**: 未ログインユーザーの読書進捗は **サーバに一切記録しない**。

- 理由: `reading_progress` は `user_id NOT NULL`（[data-model.md](../foundation/data-model.md)）であり、匿名 ID を発行して記録することは PRD §58 のプライバシー原則（不必要な個人追跡をしない）に反する。Cookie ベースの匿名トラッキングは追跡コストの割に価値が低い（ログインしてこそ「続きから読む」の価値が出る）。
- ゲスト向け代替: フロントの reading island が **localStorage** に `{novelId: {episodeId, position, updatedAt}}` を保存し、同一ブラウザでの「前回の続きへ」リンクをクライアント側でのみ表示する（サーバ SSR には出さない、hydration 後に island が描画）。ログインを促す導線として使う。
- ログイン時の引き継ぎ: ログイン直後、localStorage に該当 Novel のエントリがあり、かつサーバ側 `reading_progress` が存在しない/より古い場合に限り、1回だけ `POST /api/episodes/{episodeId}/reading-progress` でサーバへ反映してよい（任意実装、必須ではない。詳細は未決事項）。
- Analytics イベント（`episode_view` 等）はゲストでも匿名集計目的で送信されうるが、これは `analytics_events` 側の方針（[analytics.md](./analytics.md)）に従い、個人特定情報を含めない。Reading Progress とは独立に扱う。

---

## 2. Library（PRD §19）

### 2.1 状態定義

`library_entries.state`（enum `library_state`、[data-model.md](../foundation/data-model.md)）:

| 状態 | 意味 |
|---|---|
| `reading` | 現在読んでいる |
| `read_later` | 後で読む（ブックマーク） |
| `completed` | 読み終えた |
| `favorite` | お気に入り（他状態と併用ではなく排他。§2.3参照） |

1 Novel につき 1 レコード（`UNIQUE(user_id, novel_id)`）＝**状態は同時に1つ**。PRD §19 は4状態を列挙するのみで排他/並列を明示していないため、本書で以下を決定する。

- **決定**: 4状態は**排他**（1 Novel は Library 上のどれか1つの状態にしか属さない）。理由: テーブルが `UNIQUE(user_id, novel_id)` の単一行設計であり（PRD §19 の実装は data-model.md に準拠）、「Reading かつ Favorite」のようなタグ的な使い方をしたい場合は将来の Custom Collection（PRD §19「将来的には Custom Collection を作成可能にする」）で対応する。
- **代替案**（不採用）: state を配列/多対多にして併用可能にする——PRD が「標準状態」として単純な4分類のみ求めており、1.0 のスコープでは過剰。

### 2.2 状態遷移

```text
(未登録) --Library に追加(state指定)--> reading | read_later | completed | favorite
reading      --明示操作--> read_later | completed | favorite | (削除)
read_later   --明示操作--> reading | completed | favorite | (削除)
completed    --明示操作--> reading | read_later | favorite | (削除)
favorite     --明示操作--> reading | read_later | completed | (削除)
```

- 全遷移はユーザーの明示操作（`POST /api/novels/{novelId}/library` で state を指定、[routing.md](../foundation/routing.md)）。
- **自動遷移は行わない（決定）**: 「Episode 読了で自動的に Library の state を `completed` にする」という連動は**実装しない**。
  - 理由: (1) `reading_progress.is_completed` は Episode 単位、Library の `completed` は Novel 単位（全 Episode 読了 or 最終話読了の判定が曖昧）。(2) ユーザーが「読了したが Favorite のままにしたい」ケースを勝手に上書きしてしまう。(3) PRD §19 は自動遷移に触れておらず、明示操作を既定とするほうが安全。
  - 妥協案として、Novel 詳細画面に「最終話まで読み終えました。Library を Completed にしますか？」という**提案 UI**（ワンクリック確定）は許容する（自動確定ではない）。
- Library 未登録の Novel を読んでも自動で `reading` は作られない（Library 登録は常に明示操作）。

### 2.3 一覧取得（Query 層）

`GET /library`（要ログイン、本人のみ、[routing.md](../foundation/routing.md)）は Application 層の Read Model として実装する。

```text
GetMyLibraryQuery(userId, state?, page, pageSize):
  SELECT le.*, n.title, n.cover_image, n.publication_status,
         rp.episode_id AS last_read_episode_id, rp.last_read_at
  FROM library_entries le
  JOIN novels n ON n.id = le.novel_id
  LEFT JOIN LATERAL (
    SELECT episode_id, last_read_at FROM reading_progress
    WHERE user_id = le.user_id AND novel_id = le.novel_id
    ORDER BY last_read_at DESC LIMIT 1
  ) rp ON true
  WHERE le.user_id = :userId
    AND (:state IS NULL OR le.state = :state)
  ORDER BY (rp.last_read_at, le.id) DESC NULLS LAST
```

- Novel が Private/削除済みで本人が閲覧権限を失った場合（Collaborator 降格等）でも Library エントリ自体は残す（記録は削除しない）が、一覧描画時に「閲覧不可」バッジを出し詳細への遷移は 403/404 に委ねる（Novel 側の Visibility チェックに従う、[routing.md](../foundation/routing.md) §3.2 の認可列）。
- インデックスは `idx(user_id, state)`（[data-model.md](../foundation/data-model.md)）でカバー。

---

## 3. Reader Settings の永続化（PRD §17）

UI/CSS 変数の詳細は [frontend.md](../overview/frontend.md) §4.1 を参照。本節はデータの保存形・同期方式のみを扱う。

### 3.1 保存階層

```text
Priority: cookie(SSR初期反映) → localStorage(クライアント正) → server(ログイン時のバックアップ)
```

| 層 | 役割 | 対象ユーザー |
|---|---|---|
| **localStorage** | 設定の正（source of truth）。island がここへ書き込み、即座に CSS 変数へ反映 | 全ユーザー（ゲスト含む） |
| **cookie**（例 `reader_settings`, 小さい JSON） | SSR 初回レスポンス時に `<html>` へ設定を反映し FOUC を防ぐためのミラー。localStorage と値が乖離したら localStorage 側で上書き | 全ユーザー |
| **server**（ログイン時のみ） | 端末をまたいだ同期のためのバックアップ。ログイン中のみ非同期で読み書き | ログインユーザーのみ |

- **決定**: localStorage を正とし、cookie は「初回描画のちらつき防止用の read-only ミラー」に限定する。理由: Reader Settings は見た目の設定でありプライバシー影響がなく、サーバ往復を必須にすると設定変更の体感速度が落ちる（PRD §55 パフォーマンス方針、frontend.md も同様の考え方）。
- cookie 書き込みは island が `document.cookie` に対して行う（サーバセッションと独立、非 HttpOnly。認証情報を含まないため XSS 影響は限定的だが、CSP 方針は [architecture.md](../overview/architecture.md)/PRD §59 に準拠）。

### 3.2 保存形（JSON スキーマ）

localStorage キー `renovel:reader-settings`、cookie キー `reader_settings`（同一構造、cookie は容量制約のため短縮キーでもよい）:

```json
{
  "fontSize": "md",
  "lineHeight": "normal",
  "contentWidth": "md",
  "fontFamily": "system",
  "writingDirection": "horizontal",
  "theme": "light"
}
```

| フィールド | 型 / 取りうる値 | PRD 対応 |
|---|---|---|
| `fontSize` | `sm` \| `md` \| `lg` \| `xl` | Font Size |
| `lineHeight` | `compact` \| `normal` \| `loose` | Line Height |
| `contentWidth` | `narrow` \| `md` \| `wide` | Content Width |
| `fontFamily` | `system` \| `serif` \| `sans` \| `mincho` 等 | Font |
| `writingDirection` | `horizontal` \| `vertical` | Writing Direction |
| `theme` | `light` \| `dark` \| `sepia` | Theme |

- 未設定/破損データはアプリ側デフォルト（`md`/`normal`/`md`/`system`/`horizontal`/`light`）にフォールバックし、例外を投げない。
- スキーマにバージョンを持たせない（1.0 は項目追加のみを想定、破壊的変更が出たら `v` フィールドを追加）。

### 3.3 ログイン時のサーバ同期

`PATCH /api/me/reader-settings`（[routing.md](../foundation/routing.md) 3.2）:

- **保存先**: 専用テーブルを新設せず、`users` テーブルに `reader_settings jsonb NULL` カラムを追加する形を既定案とする（1ユーザー1設定で正規化するメリットが薄いため）。テーブル追加が必要になった場合は [data-model.md](../foundation/data-model.md) 側の変更として扱う（本書では未確定、§未決事項に記載）。
- **同期方向**: ログイン中は「localStorage → サーバ」への一方向バックアップを基本とする（設定変更のたびに debounce して PATCH）。ログイン直後・別端末での初回表示時のみ「サーバ → localStorage」の取り込みを行う（`server.updated_at` 相当は持たず、単純に「localStorage が空 or デフォルトのままならサーバ値で初期化」という弱い同期で十分。1.0 では最終更新端末優先の厳密な競合解決は行わない）。
- **非ブロッキング**: 設定変更の反映（CSS 変数書き換え）は常にローカルで即時に行い、サーバ PATCH は fire-and-forget（失敗しても UI をブロックしない、リトライは次回変更時に任せる）。
- **ゲスト**: サーバ保存なし。localStorage + cookie のみで完結する（routing.md 「認証不要（未ログインは cookie のみ）」の通り）。

---

## 4. プライバシー（PRD §58）

- **原則**: 読書履歴（`reading_progress`）・Library（`library_entries`）は**本人にのみ**開示する。作者・Collaborator・他の読者向けの画面/API は、個人単位の「誰が」「いつ」「どこまで」読んだかを一切含めてはならない。
- **具体的な禁止事項**:
  - Episode 詳細・Novel 管理画面（Studio）に「読者一覧と各人の既読位置」を出す機能は作らない。
  - Analytics ダッシュボード（[analytics.md](./analytics.md)）は `analytics_daily`/`analytics_hourly` 等の**集計テーブルのみ**を参照し、`reading_progress` を直接 JOIN してはならない（ドメイン境界としても Analytics は Reading の内部テーブルに依存しない）。
  - Library の `favorite`/`reading` 等の状態も同様に非公開（「この作品をお気に入りにしている人数」のような**集計値**は許容するが、個人の特定・列挙はしない）。
- **Repository 設計上の担保**: `ReadingProgressRepository`/`LibraryRepository` の取得系メソッドは必ず呼び出し元の `userId` を引数に取り、「本人の行のみ」を返すインターフェースにする（`findByUserAndNovel(userId, novelId)` のように、他人の ID を渡しても取得できてしまう汎用 `findByNovel(novelId)` のような API は公開しない、または Application 層で常に `c.get("user").id` と照合する）。認可はコントローラだけでなく Application Service でも二重に担保する（PRD §59「UI だけでなく Server Side で必ず Authorization」）。
- Analytics イベント送信（`episode_progress_25` 等）は個人特定情報を持たない集計目的のイベントとして扱い、`reading_progress` の内容（本人限定データ）とは別ドメインの管轄とする（[analytics.md](./analytics.md) 参照）。

---

## 5. 関連ドキュメント

- [data-model.md](../foundation/data-model.md) — `reading_progress` / `library_entries` テーブル定義の正典
- [frontend.md](../overview/frontend.md) §4 — Reader UI・CSS 変数・レイアウトシフト対策
- [routing.md](../foundation/routing.md) §3.2 — Reading 系ルート表・認可列
- [analytics.md](./analytics.md) — 進捗系 Analytics イベントと集計方針（プライバシー境界）
- [text-notation.md](./text-notation.md) — 段落分割・ルビ/傍点変換（`position` の段落 index が前提とする構造）
- [architecture.md](../overview/architecture.md) §7 — Analytics/非ブロッキング送信方針

---

## 未決事項

- Reader Settings のサーバ保存先を `users.reader_settings jsonb` にするか専用テーブル `reader_settings` に切り出すかは未確定（1.0 は前者を既定案とする）。
- ゲスト → ログイン時の localStorage 進捗のサーバへの引き継ぎ（§1.5）を 1.0 スコープに含めるか、将来機能に回すかは未確定。
- 複数端末で Reader Settings が食い違った場合の競合解決（現状は「弱い同期」で妥協）を、将来 `updated_at` ベースの Last-Write-Wins に強化するかは未確定。
- Library の Custom Collection（PRD §19 将来機能）のテーブル設計（`collections`/`collection_entries`）は本書スコープ外、着手時に本書と data-model.md を更新する。
- Episode 削除・Novel Private 化時に既存の `reading_progress`/`library_entries` を物理削除するか残すか（現状 data-model.md は物理削除方針だが、FK の `ON DELETE CASCADE` により Episode/Novel 削除時は連鎖削除される。Visibility を Private に変更しただけの場合はレコードを残す前提で§2.3を書いたが、要合意）。
