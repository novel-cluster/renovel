# Social & Notification Design / ソーシャル・通知設計

> 対象: Like / Star / Review / Comment（PRD §20）、Follow（PRD §21）、Notification（PRD §22）。
> 正典は PRD §20–22。テーブル定義の正典は [data-model.md](./data-model.md)（`likes`/`stars`/`reviews`/`comments`/`user_follows`/`novel_follows`/`notifications`）で、本書はそれを前提に業務ロジック・状態遷移・配信方式を定義する。
> 現状は scaffold。本書は目標形。

## サマリー

- Like は Episode 単位・1 user 1 episode・取消可（行削除）。Star は Novel 単位 1〜3 の**簡易評価**、Review は Star＋Title＋Body を持つ**独立した 1 user 1 novel の意見表明**で、両者は同期させない（別軸のまま保持）。
- Comment は Episode 単位・**フラット＋1 段返信**・**読了ゲート**（`reading_progress.is_completed = true` を前提条件とする）を課す。モデレーションは削除は Soft Delete、非表示は [moderation.md](./moderation.md) に委譲。
- Follow は User Follow（ソーシャルグラフ、フィード用途）と Novel Follow（作品purely更新通知用サブスクリプション）を明確に分離する。
- Notification は初期 In-App のみ、**fan-out-on-write（push 型）**で `notifications` に事前展開し、**同種通知は一定時間窓でバッチ集約**して通知疲れを防ぐ。将来 Web Push / Email は配信チャネルを追加する形で拡張する。
- 各ソーシャルアクションは transactional 更新と**同一トランザクションでカウンタ更新**を行い、**analytics イベント発火は非同期・非ブロッキング**で分離する（[analytics.md](./analytics.md)）。

---

## 1. Like（PRD §20.1）

### 1.1 定義

| 項目 | 内容 |
|---|---|
| 対象単位 | Episode |
| 意味 | 「この話が良かった」という軽い好意表明 |
| 一意性 | 1 user につき 1 Episode 1 Like（`UNIQUE(user_id, episode_id)`） |
| 取消 | 可能。取消＝行削除（物理削除、[data-model.md](./data-model.md) §Soft Delete 方針） |
| 未ログイン | 不可（要認証）。ボタンはログインへ誘導 |

### 1.2 操作フロー

```
POST   /episodes/:episodeId/like    → 作成（既にあれば 200 で冪等 or 409 の方針は実装時に選択。推奨: 冪等 upsert）
DELETE /episodes/:episodeId/like    → 取消（存在しなければ 404 でも 204 でも良いが冪等推奨）
```

- **決定 / 理由 / 代替案**: Like のトグルは**冪等 API**（同じ状態への再リクエストはエラーにしない）にする。理由: UI 側の連打・二重送信・オフライン再送に強くする（Reader First＝読書体験を邪魔しない）。代替案（厳密な作成/削除で 409/404 を返す）は不採用。

### 1.3 集計

- `episodes` 側に `like_count` は持たない想定（[data-model.md](./data-model.md) では `novels.like_count` のみ denormalize）。Episode 単位の Like 数は一覧表示の主要指標ではないため、**Episode 詳細表示時に `COUNT` または Episode 側にも `like_count` を追加するかは実装時に決定**（未決事項参照）。
- `novels.like_count` は「Novel 配下の全 Episode の Like 合計」として、Like 作成/取消のトランザクション内でインクリメント/デクリメントする（N+1 回避、[architecture.md](./architecture.md) §9）。

---

## 2. Star（PRD §20.2）

### 2.1 定義

| 項目 | 内容 |
|---|---|
| 対象単位 | Novel |
| 意味 | 作品全体への**3段階評価**（Review 本文を書かない軽量な星評価） |
| 値域 | 1〜3（`CHECK value IN (1,2,3)`） |
| 段階の意味 | 1 = 普通〜合わなかった／2 = 良かった／3 = とても良かった（★の意味づけは UI ラベルで明示し、5段階評価の直感と混同させない） |
| 一意性 | 1 user 1 Novel（`UNIQUE(user_id, novel_id)`）。再投票は upsert で上書き |
| 取消 | 可能（行削除）。取消は「評価しない」に戻すことを意味する |

### 2.2 集計

- `novels.star_avg`（`numeric(3,2)`）・`novels.star_count` をキャッシュとして保持（[data-model.md](./data-model.md)）。Star 作成/更新/削除のトランザクション内で再計算する。
- **平均の再計算式**:
  - 追加: `star_avg' = (star_avg * star_count + new_value) / (star_count + 1)`, `star_count' = star_count + 1`
  - 更新（同一ユーザーが値を変更）: `star_avg' = (star_avg * star_count - old_value + new_value) / star_count`
  - 削除: `star_avg' = star_count > 1 ? (star_avg * star_count - value) / (star_count - 1) : 0`, `star_count' = star_count - 1`
  - 浮動小数の誤差蓄積を避けるため、**定期整合バッチ**（`SELECT AVG(value), COUNT(*) FROM stars WHERE novel_id = ?` で再計算し `novels` に反映）を日次で走らせ、差分を補正する（[data-model.md](./data-model.md) の「カウンタ列は social 側の追記時にトランザクションで更新、または定期整合バッチ」に準拠）。
- **分布**（1/2/3 の内訳）は Novel 詳細ページの評価内訳表示に使う。`stars` テーブルへの `GROUP BY value` 集計で算出。高トラフィック作品では作者向けダッシュボードのみでキャッシュ（[analytics.md](./analytics.md) の集計基盤に相乗り可、ただし `stars` は transactional なので直接クエリが基本）。

### 2.3 Star と Review の関係（未決事項の前振り）

- `stars.value`（単独 Star）と `reviews.stars`（Review 内の評点）は**データモデル上は独立**（[data-model.md](./data-model.md) §500 に明記）。
- **決定 / 理由 / 代替案**:
  - 決定: 1.0 では**同期しない**。Review 投稿は Star とは別導線とし、Review 投稿時に Star を自動設定/上書きしない。
  - 理由: PRD §20.2 と §20.3 が別項目として定義されており、「気軽な星だけ」と「本気のレビュー」というユーザー心理上の別行動を尊重する。強制同期すると「Review を書いたら既存の軽い Star が上書きされて驚く」という UX 事故を招く。
  - 代替案: (a) Review 投稿時に `stars` を upsert して常に同期 → 実装は単純だが上記の驚き最小原則(POLA)に反するため不採用。(b) UI 上で「Review の評点を Star にも反映しますか」を都度確認 → 1.0 では過剰実装として見送り、将来検討（未決事項）。

---

## 3. Review（PRD §20.3）

### 3.1 定義

| 項目 | 内容 |
|---|---|
| 対象単位 | Novel |
| フィールド | Stars(1–3, 必須) / Title(必須) / Body(必須) / User / Created At |
| 一意性 | 1 user 1 Novel（`UNIQUE(user_id, novel_id) WHERE deleted_at IS NULL`） |
| 編集 | 可能。既存 Review の Title/Body/Stars を上書き（`updated_at` 更新）。編集は再投稿ではなく同一レコードの UPDATE |
| 削除 | ユーザー自身による削除、または moderation による削除。いずれも Soft Delete（`deleted_at`） |
| 再投稿 | 削除後は `deleted_at IS NOT NULL` になるため、部分 UNIQUE 制約により再度 Review 投稿が可能 |

### 3.2 状態遷移

```
(なし) --投稿--> Active --編集--> Active
Active --削除(本人)--> Deleted(soft)
Active --削除(モデレーション)--> Deleted(soft, moderation記録付き)
Deleted --再投稿--> Active（新規レコード。旧レコードは deleted_at 保持のまま残す）
```

- 表示: `deleted_at IS NOT NULL` の Review は一覧・平均計算から除外。モデレーション削除の場合は監査目的でレコードは物理削除しない（[moderation.md](./moderation.md) 参照）。

### 3.3 権限

- 作成/編集/削除（本人）: ログインユーザー本人のみ（`reviews.user_id = c.get("user").id` をサーバ側で検証）。
- 削除（モデレーション）: [moderation.md](./moderation.md) の Admin 権限。

---

## 4. Comment（PRD §20.4）

### 4.1 定義

| 項目 | 内容 |
|---|---|
| 対象単位 | Episode |
| 構造 | **フラット＋1 段返信**（`parent_id` は NULL＝トップレベル、または「トップレベルコメントの id」のみ許可。返信への返信は不可） |
| 投稿条件 | **読了ゲート**（4.2 参照） |
| 将来拡張 | Paragraph Comment（段落単位コメント、PRD §20.4 将来検討）— `paragraph_ref` 列追加を想定した拡張余地を残す |

### 4.2 読了ゲートの判定

PRD §20.4「ユーザーはEpisode読了後に感想を投稿できる」を以下のロジックで実装する。

- **判定基準**: `reading_progress` テーブル（[data-model.md](./data-model.md)）の `WHERE user_id = :userId AND episode_id = :episodeId AND is_completed = true` が存在すること。
- **判定タイミング**: コメント投稿 API（`POST /episodes/:episodeId/comments`）呼び出し時に、Application Service（`PostCommentService` 相当）内でサーバ側チェックを行う。**UI 側の非表示だけに頼らない**（CLAUDE.md の「認可はサーバ側で強制」原則を Comment の投稿条件にも適用）。
- **UI 挙動**: 未読了ユーザーには「読了後にコメントできます」の案内を表示し、投稿フォームを無効化（ただし最終防御はサーバ側判定）。
- **境界ケース**:
  - Episode が改稿（新 Revision 公開）された後: 読了フラグは Episode 単位で保持されるため、改稿後も既存の `is_completed = true` は有効のまま（再読了を強制しない）。理由: 改稿のたびにコメント資格を失うのは体験として過剰。
  - 作者自身のコメント: 作者は自作を「読了」する導線が薄いため、**Owner/Collaborator は読了ゲートを免除**する（実装は投稿時に `collaborators` の該当 Novel エントリの有無を確認）。これは PRD に明記がないため未決事項にも記載する。

### 4.3 スレッド構造の選択

- **決定**: フラット＋1 段返信のみ（[data-model.md](./data-model.md) の決定を踏襲）。
- **理由**: Comment の主用途は「読了後の一言感想」であり、議論の深追いを目的としない（Reader First の思想上、コメント欄が長大な議論スレッドに肥大化することを避ける）。実装コストも「親は必ずトップレベル」という制約で単純化できる（再帰クエリ不要、`GROUP BY parent_id` で1回のクエリに畳み込める）。
- **代替案**: 無限ネスト（Reddit 型）→ UI 複雑化・N+1 リスク・モデレーション対象の増加により不採用。フラット（返信なし）→ 「作者からの返信」需要（作者が読者コメントに一言返す）を満たせず不採用。

### 4.4 表示順・取得

- 一覧: `(episode_id, created_at DESC) WHERE deleted_at IS NULL` index を使用（[data-model.md](./data-model.md)）。トップレベルを `created_at DESC` で取得し、各トップレベルに紐づく返信（`parent_id = トップレベルid`）を `created_at ASC` で畳んで表示。
- N+1 回避: トップレベル一覧取得後、該当 `parent_id` 群に対する返信を `IN` 句で一括取得する（Application の Query 層、[architecture.md](./architecture.md) §9）。

### 4.5 モデレーション連携

- 削除（本人）: Soft Delete（`deleted_at`）、表示は「削除されたコメント」のプレースホルダ（スレッド構造を保つため物理削除しない。返信が残っている場合に親が消えると文脈が壊れるため）。
- 通報・非表示・モデレーション削除: [moderation.md](./moderation.md) を参照。`report_target_type = 'comment'` に連携。

---

## 5. Follow（PRD §21）

### 5.1 User Follow と Novel Follow の違い

| 項目 | User Follow | Novel Follow |
|---|---|---|
| 対象 | User（作者/読者問わず） | Novel（作品） |
| 目的 | ソーシャルグラフ形成。将来の「フォロー中の新着」フィード等の基盤 | **更新通知の購読**（PRD §21「Novel Followは更新通知に利用する」） |
| 一意性 | `UNIQUE(follower_id, followee_id)`, CHECK `follower_id <> followee_id`（自己フォロー禁止） | `UNIQUE(user_id, novel_id)` |
| 通知トリガとの関係 | `user_follow` 通知（フォローされた側へ） | `novel_update`（Episode 公開時に Novel Follower 全員へ）の配信先リスト |
| 集計キャッシュ | 特になし（1.0 時点。フォロワー数表示が必要なら `users` に `follower_count` 追加を検討） | `novels.follow_count` |
| カスケード解除 | Novel 削除等の直接影響なし | Novel が非公開化（Private 化）された場合の Follower への扱いは未決事項（5.2 参照） |

### 5.2 Novel Follow と可視性変更

- Novel Follow は「更新があったら通知してほしい」という購読なので、Novel が **Private** に変更された場合でも Follow 関係自体は残す（再度 Public に戻れば通知が再開される）。ただし Private 化後の `novel_update` 通知は、Follower がその Novel への閲覧権限を持たない限り**送らない**（[auth.md](./auth.md) の可視性判定と連携し、通知作成時に閲覧可否をチェックする）。

---

## 6. Notification（PRD §22）

### 6.1 種別カタログ

PRD §22 が列挙する通知対象イベントを、発火元・受信者・payload とともに整理する。

| type (`notification_type`) | 発火元アクション | 受信者 | actor_id | payload 例 | 集約対象 |
|---|---|---|---|---|---|
| `user_follow` | User A が User B をフォロー | フォローされた User B | User A | `{ followerId }` | ○（同一 followee への複数フォロー） |
| `novel_follow` | User が Novel をフォロー | Novel の Owner | フォローした User | `{ novelId }` | ○ |
| `like` | Episode に Like | Episode/Novel の Owner | Like したユーザー | `{ novelId, episodeId }` | ○（同一 Episode への複数 Like） |
| `star` | Novel に Star | Novel の Owner | Star したユーザー | `{ novelId, value }` | ○ |
| `review` | Novel に Review 投稿 | Novel の Owner | Review 投稿者 | `{ novelId, reviewId }` | △（本文言及のため集約は控えめに） |
| `comment` | Episode にコメント | Episode/Novel の Owner、および親コメントの投稿者（返信時） | コメント投稿者 | `{ novelId, episodeId, commentId, parentId? }` | ○（同一 Episode への複数コメント） |
| `novel_update` | Episode 公開（Publish） | Novel Follower 全員 | Novel の Owner（代表） | `{ novelId, episodeId }` | × （Follower ごとに個別だが1公開=1バッチ配信） |
| `collaboration_invite` | Collaborator 招待送信 | 招待された User | 招待した User | `{ novelId, role }` | × |
| `fork` | Novel が Fork された | 元 Novel の Owner | Fork 実行者 | `{ originalNovelId, forkedNovelId }` | × |
| `change_proposal` | Change Proposal 提出/承認/却下 | 提案先（Owner/Admin）または提案者 | 相手側ユーザー | `{ novelId, proposalId, action }` | × |

- Owner が複数 Collaborator を持つ Novel の場合、`like`/`star`/`review`/`comment`/`novel_follow` の通知は **Owner のみ**に送るのか **Admin 以上全員**に送るのかは実装判断が必要（未決事項）。1.0 では **Owner のみ**を既定とし、将来 Collaborator 単位の通知設定を追加する。

### 6.2 fan-out 方式: push（作成時展開）

- **決定**: fan-out-on-write（イベント発生時に受信者ごとの `notifications` 行を事前生成する push 型）を採用する。
- **理由**:
  - `notifications` は「受信者ごとの未読管理」が主目的であり、pull 型（参照時に集計してオンザフライ生成）では**既読状態を受信者ごとに個別管理できない**（誰がどれを読んだかを別テーブルで持つ必要が生じ、かえって複雑）。
  - 1.0 のスケール（Novel Follower 数が数千〜数万オーダーになるまで）では書き込みコストは許容範囲。`novel_update` のような多数宛先イベントのみ非同期ワーカー（`worker` サービス、[infrastructure.md](./infrastructure.md) §3.2）に委譲してリクエストをブロックしない。
- **代替案**: pull 型（`user_follows`/`novel_follows`/Like 等の生ログを都度集計してタイムライン風に表示）→ 未読管理・パーソナライズ通知には不向き、SNS のフィードのような「集約表示専用」用途に限れば有効だが、Notification の主目的（未読バッジ・個別既読）に合わないため不採用。

### 6.3 配信フロー

```
Like/Star/Review/Comment/Follow などのドメインイベント発生
  → Application Service がトランザクション内で本体データ(likes等)をコミット
  → 通知対象を解決（Owner 1件 は同期でも可、Novel Follower 多数は非同期）
  → notifications へ INSERT（type, actor_id, payload, read_at=NULL）
  → （将来）Push/Email チャネルがあれば worker が配信
```

- **同期 vs 非同期の切り分け**:
  - 受信者が単一〜少数（`like`/`star`/`review`/`comment`/`user_follow`/`collaboration_invite`/`fork`/`change_proposal`）: Application Service 内で同期 INSERT。
  - 受信者が多数になりうる（`novel_update` の Novel Follower 全員）: `worker` サービスへジョブを投げ、非同期に fan-out する（Episode 公開処理自体をブロックしない、[architecture.md](./architecture.md) §7 の「非ブロッキング」方針と同じ考え方を通知にも適用）。
- **失敗時の扱い**: 通知生成の失敗は本体アクション（Like 成立など）を巻き戻さない。通知はベストエフォートとし、失敗はログに残す（Notification はユーザー体験の付加価値であり、トランザクションの主目的ではない）。

### 6.4 既読管理

- `read_at IS NULL` を未読とする（[data-model.md](./data-model.md)）。
- API 例:
  ```
  GET   /notifications?unreadOnly=true      … 未読一覧（index: (user_id, created_at DESC) WHERE read_at IS NULL）
  POST  /notifications/:id/read             … 個別既読化
  POST  /notifications/read-all             … 一括既読化（UPDATE ... SET read_at = now() WHERE user_id = ? AND read_at IS NULL）
  ```
- 未読バッジのカウントは `COUNT(*) WHERE user_id = ? AND read_at IS NULL`（部分 index があるため軽量）。高頻度アクセスが問題になれば `users` 側に `unread_notification_count` を追加してキャッシュ（1.0 では不要、将来検討）。

### 6.5 集約・バッチ（同種通知のまとめ）

Notification の乱発を防ぎ、通知疲れ（notification fatigue）を避けるため、同種・同対象の通知は一定時間窓でまとめる。

- **対象**: `like` / `star` / `comment` / `user_follow` / `novel_follow`（6.1 表の「集約対象」列が○のもの）。
- **方式（決定）**: **書き込み時マージ方式**。同一 `(user_id, type, target=payload内のnovel_id/episode_id)` の未読通知が既に存在する場合、新規行を追加せず、既存行の `payload` に行為者を追記し `updated_at` を更新する（「Aさん他4人があなたのEpisodeにLikeしました」の表示に使う）。
  - `payload` 例（集約後）: `{ "novelId": "...", "episodeId": "...", "actorIds": ["u1","u2","u3"], "count": 5 }`
  - マージの窓: 既読化されるまで（または生成から 24 時間、いずれか早い方）は同一 `(user_id, type, target)` に対して追記し続け、既読化 or 期限超過後は新しい通知として別行を作る。
- **理由**: 別テーブルで「集約グループ」を管理する方式より、`notifications.payload` (jsonb) に追記するほうがスキーマがシンプルで、`notifications` の主キー構造を変えずに済む。
- **代替案**: 個別に全行 INSERT し、表示側（Query 層）で `GROUP BY (type, novel_id, episode_id, DATE_TRUNC('hour', created_at))` して集約表示する pull 型集約 → 書き込みは単純だが、既読管理が「グループ内の一部だけ既読」という中途半端な状態になりやすく不採用。ただし実装コストの観点で**将来この方式へ移行する余地は残す**（未決事項）。
- `review` は集約しない（本文の個別性が高く、まとめると情報が失われるため）。`novel_update`/`collaboration_invite`/`fork`/`change_proposal` は元々 1 対 1 または低頻度のため集約不要。

### 6.6 将来の Push / Email 拡張

- 1.0 は In-App のみ（PRD §22）。
- 将来 Web Push / Email を追加する際は、`notifications` テーブル自体は変更せず、**配信チャネルテーブル**（例: `notification_deliveries(notification_id, channel, status, sent_at)`）を追加し、`worker`（[infrastructure.md](./infrastructure.md) §3.2）が `notifications` 作成をトリガに各チャネルへの配信ジョブを積む構成にする。
- チャネルごとのユーザー設定（「Like はアプリ内のみ、Novel Update はメールも」等）は `notification_preferences(user_id, type, channel, enabled)` のような設定テーブルを別途追加する想定（未決事項）。

---

## 7. Analytics イベントとの連携（[analytics.md](./analytics.md)）

各ソーシャルアクションは、transactional data の更新に加えて analytics イベントを発火する。PRD §36 のイベントカタログとの対応は以下の通り。

| アクション | analytics event_type | 備考 |
|---|---|---|
| Like 作成 | `like` | 取消時のイベント送信は行わない（1.0 では「取消」専用イベントは定義しない） |
| Star 作成/更新 | `star` | `props` に `value` を含めてよい（最小限） |
| Review 投稿 | `review` | 本文は含めない（`props` は分析用の最小情報のみ、PRD §36） |
| Comment 投稿 | `comment` | 本文は含めない |
| Follow（User/Novel） | `follow` | `props.followTargetType` で `user`/`novel` を区別 |

- **決定 / 理由 / 代替案**: analytics イベント送信は、transactional な `notifications` 生成とは**別経路の fire-and-forget**（[architecture.md](./architecture.md) §7）とする。理由: 分析イベント送達の遅延・失敗が Like/Follow 等のユーザー操作の成否に影響してはならない（PRD §55 非ブロッキング原則）。同一 Application Service 内で「本体更新（同期・トランザクション内）→ 通知生成（同期 or 非同期、ベストエフォート）→ analytics イベント発火（非同期・fire-and-forget）」の順に呼び出す。
- Analytics イベントには個人を過剰に紐づけない（`user_id` はログイン時のみ、PRD §58）。Notification の `actor_id` とは目的が異なる（Notification は「誰が」を通知本文に使うために保持する。Analytics は集計目的でユーザー単位の行動追跡を最小限にする）。

---

## 8. 権限・可視性との関係

- Comment/Review/Like/Star は、対象 Novel/Episode が **Private** の場合、閲覧権限のない第三者からは投稿もできない（[auth.md](./auth.md) の可視性判定をコマンド系 API 側でも実施する）。
- Draft（未公開）Episode には Like/Comment 不可（公開済み Episode のみ対象）。
- Collaborator（[collaboration-fork.md](./collaboration-fork.md)）のうち Viewer 権限者が自身の Like/Comment を行えるかは、通常の読者と同様の可視性チェックに従う（Collaborator 権限は執筆権限であり、ソーシャル行動の可否とは独立）。

---

## 9. 未決事項

- [ ] Episode 単位の `like_count` をカラムとして持つか、都度 `COUNT` にするか（1.0 のトラフィック規模次第）。
- [ ] Star と Review の評点の将来的な同期方針（UI での「Review 評点を Star にも反映」導線の要否）。
- [ ] Comment の作者/Collaborator に対する読了ゲート免除の扱い（PRD に明記なし。本書は暫定で免除としたが要確認）。
- [ ] 複数 Collaborator を持つ Novel における Like/Star/Review/Comment/Novel Follow 通知の宛先（Owner のみ／Admin 以上全員／Collaborator ごとの通知設定）。
- [ ] Notification 集約のウィンドウ長（24 時間固定でよいか、既読までの累積で十分か）の実測後チューニング。
- [ ] Notification Preference（チャネル別・種別別の受信設定）テーブルの正式スキーマとタイミング（Push/Email 実装時）。
- [ ] Novel Follow が付いた Novel が Private 化された場合の既存 `notifications`（未読分）の扱い（そのまま残すか、非表示にするか）。
- [ ] Paragraph Comment 実装時の `paragraph_ref` の具体形式（文字オフセット／段落 index／ブロック ID）。
