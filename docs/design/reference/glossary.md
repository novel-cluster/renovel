# Glossary / 用語集（ユビキタス言語）

> 対象: PRD 全体で使われる概念のユビキタス言語定義。用語の対応ドメイン・テーブル、紛らわしい語の区別、英日 UI 表記対応。
> 正典は PRD 全体（特に §6,7,8,9,13,14,20,21）。テーブル名・カラム名は [data-model.md](../foundation/data-model.md) を正典として参照し、本書は用語の意味の正典とする（命名が食い違った場合は data-model.md を先に更新する）。
> 現状は scaffold（Phase 0 完了）。本書は「これから作る目標形」の語彙を示す。

## サマリー

- **ユビキタス言語は PRD の英語名をそのままドメイン用語・コード識別子として採用**する（`Novel`, `Episode`, `Fork` 等）。UI 表示のみ日本語化し、対応表を§4に固定する。
- **Visibility（公開範囲）と Publication Status（進行状態）は直交する別軸**であり、「Draft」は Visibility 側の概念（Status ではない）。この混同は実装上最も起きやすいため§3.1で明確化する。
- **Like（Episode 単位・賛意ボタン）と Star（Novel 単位・1–3 評価）は別概念**で、Review 内の評点（`reviews.stars`）ともテーブルが分離している。3 つを混同しない。
- **Follow は User Follow と Novel Follow の 2 種類**があり、対象・通知トリガ・テーブルが異なる。
- **Fork（作品の派生生成）と Change Proposal（変更提案）は独立した機能**で、Change Proposal は Fork なしの共同制作内でも使える。
- **Comment（Episode への感想・スレッド性あり）と Review（Novel への評価文・1 人 1 件）は別テーブル・別ライフサイクル**であり、対象単位（Episode vs Novel）と一意性制約が異なる。

---

## 1. 用語表の読み方

| 列 | 意味 |
|---|---|
| 用語 | ユビキタス言語（PRD/コード識別子として使う英語名） |
| 定義 | ドメイン上の意味 |
| 対応ドメイン | [architecture.md](../overview/architecture.md) §3 のドメイン境界（`identity, novel, writing, collaboration, fork, reading, social, discovery, analytics, notification, moderation`） |
| 対応テーブル | [data-model.md](../foundation/data-model.md) 上のテーブル名 |
| 混同注意 | 紛らわしい語との違い |

---

## 2. 用語表（コア概念）

### 2.1 identity

| 用語 | 定義 | 対応ドメイン | 対応テーブル | 混同注意 |
|---|---|---|---|---|
| **User** | ReNovel の登録アカウント。読者・作者アカウントを分離しない（PRD §6）。読む・投稿する・フォローする・評価する・コメントする・共同制作に参加する、すべてを同一アカウントが行う。 | identity | `users` | 「Author」「Reader」は User の**役割上の呼び方**であり別エンティティではない。ある Novel に対して Owner/Collaborator であれば「作者」、そうでなければ「読者」として振る舞うだけ |
| **Handle** | User を一意に識別する公開 ID。`^[a-z0-9_]{3,30}$`、大小無視。URL は `/@{handle}`（PRD §6）。 | identity | `users.handle` | **User ID（内部 UUID）とは別物**。Handle は変更可能性を将来検討する余地があるが（未決）、UUID の `id` は不変の内部識別子 |
| **Display Name** | プロフィール上の表示名。Handle と異なり一意制約なし、自由な文字列。 | identity | `users.display_name` | Handle（一意・URL用）と混同しない |
| **Session** | 認証済み状態を表すサーバ側レコード。Cookie にはハッシュ化前の opaque token を持たせる（詳細 [auth.md](../foundation/auth.md)）。 | identity | `sessions` | Hono Context 上の `c.get("session")` はこの DB レコードに対応する実行時オブジェクト |

### 2.2 novel（作品構造・PRD §7,8,9,10）

| 用語 | 定義 | 対応ドメイン | 対応テーブル | 混同注意 |
|---|---|---|---|---|
| **Novel** | 作品そのもの。1 作品 = 1 Novel。`Novel → (任意)Chapter → Episode` という木構造のルート（PRD §7.1）。 | novel | `novels` | 「Story」「Work」等の同義語は使わず常に **Novel** と呼ぶ |
| **Chapter** | Novel 内の任意の章区分。使わない作品では Episode を Novel 直下に配置する（PRD §7.1）。 | novel | `chapters` | Chapter を持たない Novel は「短編」ではなく単に「Chapter 未使用の Novel」。短編は「Episode を 1 つだけ持つ Novel」（下記 Episode 参照） |
| **Episode** | 実際に読者が読む本文の単位（「話」）。Chapter 配下または Novel 直下に配置される。短編は Episode 1 件のみの Novel として扱う（PRD §7.1）。 | novel / writing | `episodes` | **Chapter とは別の階層**。Episode は必ず `novel_id` を持ち、`chapter_id` は NULL 可（data-model.md §3 novel/episodes 参照） |
| **Revision（EpisodeRevision）** | Episode 本文の変更履歴の 1 スナップショット。Episode ごとに append-only で連番管理し、上書きされない（PRD §12）。 | writing | `episode_revisions` | **Episode.body（現在の確定本文）とは別物**。「最新の Revision」が常に `episodes.body` と一致するように運用される（詳細 [writing-revision.md](../domains/writing-revision.md)） |
| **Draft** | Episode が「未公開＝執筆中で読者に見えない」状態を指す言葉。**Novel レベルでは Status ではなく Visibility 側の概念として語られる**が、Episode レベルでは `episode_status = draft`（PRD §8, §11.4）という独立した公開前段階を表す。 | writing | `episodes.status`（enum `episode_status`） | §3.1「Draft をめぐる混同」参照。**Draft は Publication Status の値ではない**（`publication_status` の値は Ongoing/Completed/Hiatus のみ） |
| **Visibility（公開範囲）** | Novel（および個別上書き可能な Episode）の**誰に見えるか**を決める軸。Public / Unlisted / Private（PRD §9）。 | novel | `novels.visibility`, `episodes.visibility` | Publication Status と直交（§3.1）。「Draft」という値はこの enum にも存在しない — PRD の文章表現上「Draft 相当」は Private や「未公開 Episode」で表現される |
| **Publication Status（進行状態）** | Novel の**執筆の進行度**を表す軸。Ongoing / Completed / Hiatus（PRD §8）。 | novel | `novels.publication_status` | Visibility とは独立。「連載中の Private 作品」「完結した Unlisted 作品」等、あらゆる組み合わせが有効 |
| **Content Warning** | 作品に付与する閲覧前警告のタグ集合（R15 相当・暴力描写等）。閲覧前に警告画面を出すことがある（PRD §10）。 | novel | `novels.content_warnings`（jsonb） | Genre・Tag（作品分類・発見用）とは目的が異なり、**警告表示専用** |
| **Genre** | 作品の主分類（1 Novel に 1 つ、curated enum）。 | novel / discovery | `novels.genre` | Tag（複数付与可・自由度が高いフリーの分類）と役割が異なる |
| **Tag** | 作品に複数付与できる分類・検索キーワード。 | discovery | `tags`, `novel_tags` | Genre は単一・統制語彙、Tag は複数・準自由入力 |

### 2.3 writing / editor（PRD §11,12）

| 用語 | 定義 | 対応ドメイン | 対応テーブル | 混同注意 |
|---|---|---|---|---|
| **Ruby（ルビ記法）** | `｜文章《ルビ》` という独自プレーンテキスト記法。表示時 `<ruby>文章<rt>ルビ</rt></ruby>` に変換（PRD §11.2）。 | writing | （`episodes.body`/`episode_revisions.body` 内の記法。専用テーブルなし） | Markdown ではない。詳細 [text-notation.md](../domains/text-notation.md) |
| **Emphasis（傍点）** | `《《文章》》` という独自記法。傍点表示に変換（PRD §11.3）。 | writing | 同上 | Ruby の `《...》` と字面が似るが構文が異なる（外側 `｜...《...》` vs `《《...》》`）。詳細 [text-notation.md](../domains/text-notation.md) |
| **Scheduled Publish（公開予約）** | 指定日時に Episode を自動公開する仕組み（PRD §11.4）。 | writing | `scheduled_publishes` | Publish（即時手動公開、`episodes.status='published'` への遷移）とは別のオペレーション。予約は実行されて初めて Publish が起きる |
| **Restore（復元）** | 過去 Revision の内容で新しい Revision を追記し、Episode の現在本文を差し戻す操作（PRD §12）。 | writing | `episode_revisions.restored_from_id` | 「過去の行を上書きする」のではなく**新しい Revision を作る**（追記専用の原則、[writing-revision.md](../domains/writing-revision.md)） |

### 2.4 collaboration / fork（PRD §13,14,15,16）

| 用語 | 定義 | 対応ドメイン | 対応テーブル | 混同注意 |
|---|---|---|---|---|
| **Collaborator** | Novel に対してロールを持つ User（Owner 自身も Collaborator の一種として `role='owner'` で保持）。 | collaboration | `collaborators` | Owner（`novels.author_id`）は「原作者・作成者」を指す別属性としても保持されるが、通常は owner Collaborator と一致する（data-model.md `novels` 備考） |
| **Role（Collaborator Role）** | Collaborator に付与される権限区分。Owner / Admin / Writer / Editor / Viewer の 5 段階（PRD §13）。 | collaboration | `collaborators.role`, `collaboration_invitations.role`（enum `collaborator_role`） | 権限マトリクスの詳細は [auth.md](../foundation/auth.md) / [collaboration-fork.md](../domains/collaboration-fork.md) |
| **Collaboration Invitation** | User を Collaborator として招待する未確定状態のレコード。承諾されると `collaborators` 行が作られる（PRD §13）。 | collaboration | `collaboration_invitations` | Collaborator（確定した参加者）とは別テーブル。ステータス（pending/accepted/…）を持つのは Invitation のみ |
| **Fork** | 許可された Novel から派生作品（別 Novel）を作る操作、およびその派生関係を記録するレコード（PRD §14）。派生元（Source Novel）への帰属表示は削除できない（PRD §15）。 | fork | `forks` | Change Proposal（変更提案）とは別機能。Fork は「作品まるごとの複製・派生」、Change Proposal は「既存 Novel への差分提案」 |
| **Fork Policy** | Owner が Novel ごとに設定する Fork 許可方針。Disabled / Approval Required / Allowed（PRD §15）。 | fork | `novels.fork_policy` | Visibility とは別軸（Public でも Fork Disabled はあり得る） |
| **Source Novel（原作）/ Forked Novel（派生作品）** | Fork 関係における派生元／派生先の Novel。 | fork | `forks.source_novel_id` / `forks.forked_novel_id` | 「Original Novel」（PRD §7.2 のメタデータ項目）は Forked Novel から見た Source Novel を指す表示上の呼称と同義 |
| **Change Proposal** | Fork または共同制作の文脈で、既存 Novel/Episode への変更を提案する GitHub Pull Request 型の機能（PRD §16）。Accept / Reject / Comment できる。 | fork / collaboration | `change_proposals`, `change_proposal_comments` | Fork（作品そのものの派生生成）とは独立した機能で、Fork なしの共同制作内提案（`source_novel_id` が NULL）にも使う |

### 2.5 reading（PRD §17,18,19）

| 用語 | 定義 | 対応ドメイン | 対応テーブル | 混同注意 |
|---|---|---|---|---|
| **Reading Progress** | User が Episode をどこまで読んだかの本人専用記録（最後に読んだ Episode・位置・読了フラグ・最終閲覧日時、PRD §18）。 | reading | `reading_progress` | **本人閲覧専用**で作者や他者には見せない（PRD §58）。Analytics の集計値（誰が読んだかは含まない）とは別物 |
| **Library** | User が Novel を分類保存する仕組み。Reading / Read Later / Completed / Favorite（PRD §19）。 | reading | `library_entries` | Reading Progress（Episode 単位の閲覧位置）とは別概念。Library は Novel 単位の「本棚」的分類 |
| **Reader Settings** | 読書表示のカスタマイズ設定（Font Size・Line Height・Content Width・Font・Writing Direction・Theme、PRD §17）。 | reading（Presentation island） | （専用テーブルなし。クライアント永続化が基本、[frontend.md](../overview/frontend.md)） | Reading Progress とは無関係。表示設定であり、進捗データではない |

### 2.6 social（PRD §20,21）

| 用語 | 定義 | 対応ドメイン | 対応テーブル | 混同注意 |
|---|---|---|---|---|
| **Like** | Episode 単位の「この話が良かった」という賛意表明。1 User につき 1 Episode 1 Like、取り消し可能（PRD §20.1）。 | social | `likes` | **Star とは対象単位が異なる**（Episode vs Novel）。§3.2 参照 |
| **Star** | Novel 単位の作品全体評価（1〜3、PRD §20.2）。 | social | `stars` | **Like（Episode 単位・賛否のみ）とも Review 内の評点（`reviews.stars`）とも別テーブル**。§3.2, §3.4 参照 |
| **Review** | Novel 単位のレビュー。Stars・Title・Body を持つ、1 User につき 1 Novel 1 Review（PRD §20.3）。 | social | `reviews` | Comment（Episode 単位・スレッド性あり）とは対象単位もライフサイクルも異なる。§3.4 参照 |
| **Comment** | 基本 Episode 単位の感想投稿。読了後に投稿する想定。フラット＋1 段返信まで（PRD §20.4）。 | social | `comments` | Review（Novel 単位・1 人 1 件・評点つき）と混同しない。§3.4 参照 |
| **User Follow** | User が別の User をフォローする関係（PRD §21）。 | social | `user_follows` | Novel Follow とは対象・用途が異なる |
| **Novel Follow** | User が Novel をフォローし、更新通知（`novel_update`）を受け取る関係（PRD §21）。 | social | `novel_follows` | User Follow とは別テーブル・別通知トリガ。§3.3 参照 |

### 2.7 discovery / notification / analytics / moderation

| 用語 | 定義 | 対応ドメイン | 対応テーブル | 混同注意 |
|---|---|---|---|---|
| **Ranking** | 一定期間・軸（daily/weekly/monthly/new/completed）で Novel を順位付けした集計結果（PRD §26）。 | discovery | `ranking_snapshots` | リアルタイム動的計算ではなく、定期ジョブで固定したスナップショット（詳細 [discovery.md](../domains/discovery.md)） |
| **Notification** | User 宛てのアプリ内通知。フォロー・Like・Star・Review・Comment・作品更新・招待・Fork・変更提案などが種別として存在（PRD §22）。 | notification | `notifications` | Analytics Event（内部計測用の生ログ）とは異なり、Notification は**受信者に見える UI 要素**。詳細 [social-notification.md](../domains/social-notification.md) |
| **Analytics Event** | 読者行動・Acquisition 等を記録する内部計測用の生イベント（PRD §36）。append-only で個人特定情報を最小化して記録する。 | analytics | `analytics.analytics_events` | **Notification とは無関係**（読者には見えない）。**Reading Progress（本人用の進捗）とも別物**（作者向けの匿名集計にのみ使われる、PRD §58）。集計は `analytics_hourly`/`analytics_daily` にロールアップ（詳細 [analytics.md](../domains/analytics.md)） |
| **Report（通報）** | User/Novel/Episode/Comment/Review を対象とするモデレーション通報（PRD §37）。 | moderation | `reports` | Notification（本人への肯定的な通知）とは目的が逆。Report は管理者向けキューに入る |
| **Block / Mute** | User 間の相互作用制御。Block は双方向的な遮断、Mute は自分側の表示抑制のみ（PRD §37）。 | moderation | `blocks` / `mutes` | Block は相手にも影響する（コメント・フォロー等の可否）、Mute は自分の画面表示にのみ影響し相手には作用しない |

---

## 3. 特に区別が必要な概念（詳細解説）

### 3.1 Visibility と Publication Status（最頻出の混同）

PRD §8「Draft は作品状態ではなく Visibility によって表現する」という一文が誤読されやすいため、以下の表で軸を完全に分離する。

| 軸 | 名称 | 値 | 意味 | 保存先 |
|---|---|---|---|---|
| **誰が見られるか** | Visibility | `public` / `unlisted` / `private` | 公開範囲。検索・ランキング・おすすめへの露出可否を決める（PRD §9） | `novels.visibility`, `episodes.visibility` |
| **どこまで書けているか** | Publication Status | `ongoing` / `completed` / `hiatus` | 執筆の進行状態（PRD §8） | `novels.publication_status` |
| **Episode が読者に出せる状態か** | Episode Status | `draft` / `published` | 個別 Episode の公開前後の別軸（[data-model.md](../foundation/data-model.md) `episodes.status` 備考） | `episodes.status` |

- **「Draft」という語自体は enum の値としては 2 箇所の異なる意味で使われる**:
  1. Novel を語るときの「Draft 状態の作品」＝ 口語表現で、実体は **Visibility=Private かつ published_at が NULL** に近い状態を指す（PRD の Draft は Publication Status の選択肢に含まれない = enum 値としては存在しない）。
  2. Episode を語るときの「Draft Episode」＝ **`episode_status='draft'`** という実在する DB 値。PRD §13 の「Viewer: Private Novel / Draft Episode などの閲覧のみ可能」の Draft はこちらを指す。
- **実装上の指針**: コード・UI 文言で「Draft」を使う場合、必ず「Novel の話（Visibility 由来の口語表現）」か「Episode の話（`episode_status`）」かを明示する。Publication Status の値一覧に `draft` を追加してはならない（PRD §8 の明示的否定）。

### 3.2 Like（Episode）と Star（Novel）

| | Like | Star |
|---|---|---|
| 対象単位 | Episode | Novel |
| 値 | boolean 相当（付与/取消のみ） | 1〜3 の整数評価 |
| 意味 | 「この話が良かった」という即時の賛意 | 作品全体への評価 |
| 一意制約 | `UNIQUE(user_id, episode_id)` | `UNIQUE(user_id, novel_id)` |
| 取り消し | 可能（行削除） | 上書き可能（値の更新） |
| 集計反映先 | `novels.like_count`（Episode 側 Like の Novel への集約） | `novels.star_avg` / `novels.star_count` |

Like は「読んでいる最中の反応」、Star は「読み終えて/通して見た作品評価」という時間軸の違いでも区別できる。

### 3.3 Follow（User / Novel）

| | User Follow | Novel Follow |
|---|---|---|
| フォロー対象 | User（作者・他読者） | Novel（特定作品） |
| テーブル | `user_follows`（`follower_id`/`followee_id`） | `novel_follows`（`user_id`/`novel_id`） |
| 主な用途 | 新着作品・活動のタイムライン表示（[discovery.md](../domains/discovery.md)） | 更新通知（`notification_type='novel_update'`）の配信対象抽出（PRD §21,22） |
| カウンタ | User 側に集計列なし（必要なら将来追加） | `novels.follow_count` |

同じ「フォロー」という言葉でも対象・通知トリガ・カウンタ先が異なるため、コード上は `UserFollow` / `NovelFollow` を独立した集約として扱う。

### 3.4 Review と Comment（対象単位とライフサイクルの違い）

| | Review | Comment |
|---|---|---|
| 対象単位 | Novel | Episode（基本） |
| 一意性 | 1 User 1 Novel（`UNIQUE(user_id, novel_id) WHERE deleted_at IS NULL`） | 制限なし（複数回投稿可能） |
| 構成要素 | Stars（1〜3）+ Title + Body | Body のみ |
| スレッド性 | なし | フラット＋1 段返信（`parent_id`） |
| 想定タイミング | 作品を通して読んだ後の総評 | Episode 読了後の感想（都度） |
| 削除 | Soft Delete（モデレーション対象） | Soft Delete（モデレーション対象、"削除されたコメント"表示） |

**Review の Stars（`reviews.stars`）と単独 Star（`stars.value`）は別テーブル・別ライフサイクルで独立管理**する（PRD が別項目として定義しているため）。両者を自動同期するかは [data-model.md](../foundation/data-model.md) §6 未決事項・[social-notification.md](../domains/social-notification.md) に委ねる。

### 3.5 Fork と Change Proposal

| | Fork | Change Proposal |
|---|---|---|
| 単位 | Novel（丸ごと複製して独立した新 Novel を作る） | Episode 単位の差分提案 |
| 前提 | `fork_policy` が Allowed/Approval Required の Novel からのみ可能 | Fork 由来（`source_novel_id` あり）でも純粋な共同制作内（`source_novel_id` NULL）でも可能 |
| 結果 | 新しい独立した Novel（帰属表示は削除不可） | Accept されると対象 Episode の本文が更新され新 Revision が追記される |
| 対応表 | `forks` | `change_proposals`, `change_proposal_comments` |

Fork は「所有権が別れる」操作、Change Proposal は「元の Novel の所有権はそのままに内容を提案する」操作という点が本質的な違い。

---

## 4. 英語 ↔ 日本語 UI 表記対応表

UI 上の表記ゆれを防ぐための対応表。実装・デザイン・コピーで以下に統一する。

| 英語（コード/PRD 用語） | 日本語 UI 表記 | 備考 |
|---|---|---|
| Novel | 作品 | 「小説」は文脈上の一般名詞として使ってよいが、UI ラベルは「作品」に統一 |
| Chapter | 章 | |
| Episode | 話（第N話） | 一覧では「第1話」のように話数表記 |
| Revision | 履歴 / リビジョン | 一覧画面では「編集履歴」、個々の項目は「リビジョン」 |
| Draft（Episode） | 下書き | |
| Publish | 公開する | |
| Publication Status: Ongoing | 連載中 | |
| Publication Status: Completed | 完結 | |
| Publication Status: Hiatus | 休載中 | |
| Visibility: Public | 公開 | |
| Visibility: Unlisted | 限定公開 | |
| Visibility: Private | 非公開 | |
| Content Warning | 閲覧注意 / コンテンツ警告 | |
| Owner | オーナー | |
| Admin（Collaborator Role） | 管理者 | User 全体の管理者（moderation）と紛らわしいため、UI では「作品管理者」と明示する |
| Writer（Collaborator Role） | 執筆者 | |
| Editor（Collaborator Role） | 編集者 | |
| Viewer（Collaborator Role） | 閲覧者 | |
| Fork | フォーク | 動詞としては「フォークする」 |
| Forked from | 派生元 | 「Forked from: 「作品名」」の表示に対応 |
| Fork Policy: Disabled | フォーク禁止 | |
| Fork Policy: Approval Required | 承認制フォーク | |
| Fork Policy: Allowed | フォーク許可 | |
| Change Proposal | 変更提案 | |
| Accept | 承認 | |
| Reject | 却下 | |
| Withdraw | 取り下げ | |
| Like | いいね | |
| Star | 評価（星） | 「☆☆☆」の UI 表現に対応 |
| Review | レビュー | |
| Comment | コメント | |
| Follow（User） | フォロー | |
| Follow（Novel） | この作品をフォロー | Follow ボタンの文言はコンテキストで区別する |
| Library | 本棚 / ライブラリ | |
| Library State: Reading | 読書中 | |
| Library State: Read Later | あとで読む | |
| Library State: Completed | 読了 | |
| Library State: Favorite | お気に入り | |
| Reading Progress | 続きから読む | 導線ラベルとして使用 |
| Notification | 通知 | |
| Report | 通報 | |
| Block | ブロック | |
| Mute | ミュート | |
| Handle | ユーザーID | プロフィール編集画面では「ユーザーID（@handle）」と表記 |
| Display Name | 表示名 | |

---

## 5. 未決事項

1. **Handle の変更可否**: PRD は Handle を User の識別子として定義するのみで、変更可能性・変更頻度制限には触れていない。URL (`/@{handle}`) の恒久性要件と合わせて [auth.md](../foundation/auth.md) で決定する。
2. **「Author」という呼称の正式な扱い**: 本書では User の役割上の呼び方（Owner/Collaborator である状態）として整理したが、UI 文言・PRD §60 Definition of Done での「作者」との対応関係を [frontend.md](../overview/frontend.md) 側で最終確定する。
3. **Review と Star の自動同期方針**: §3.4 の通り現状は独立管理。UI 上「レビューを書くと自動で Star も付く」ように見せるかは [social-notification.md](../domains/social-notification.md) の未決事項と連動して決める。
4. **Paragraph Comment 導入時の Comment 定義拡張**: PRD §20.4 の将来機能。導入時は本書 §2.6 Comment の定義・§3.4 の比較表を改訂する。
5. **Custom Collection（Library の将来拡張）の呼称**: PRD §19 の将来機能。`collections`/`collection_entries` 追加時に「Library」との用語上の親子関係（Library ⊃ Collection か、独立概念か）を確定する。
