# Writing & Revision Design / 執筆ドメイン設計

> 対象: Writing ドメイン（Episode ライフサイクル・Revision システム・Autosave 契約・Scheduled Publish）。
> 正典は PRD §7, §8, §9, §11, §12。テーブル定義の正典は [data-model.md](../foundation/data-model.md)（`episodes` / `episode_revisions` / `scheduled_publishes`）。
> Editor UI（画面構成・island 分割）は [frontend.md](../overview/frontend.md) §5 を参照。記法変換（ルビ・傍点）は [text-notation.md](./text-notation.md) を参照。権限マトリクスの正典は [collaboration-fork.md](./collaboration-fork.md) / [auth.md](../foundation/auth.md)。現状は scaffold（本書は目標形）。

## サマリー

- Episode の状態は **`episode_status`（draft/published）** と **`visibility`（継承 or 上書き）** の直交軸で表現し、Novel の Publication Status（Ongoing/Completed/Hiatus）とも独立させる。「Draft」は Episode の公開前段階を表す状態であり、Novel の Visibility とは別概念（PRD §8, §9）。
- Revision は **全文スナップショット・append-only** で保存する（`episode_revisions`、UPDATE/DELETE 禁止）。差分チェーンは復元コスト・整合リスクが高く不採用。Revision は「手動保存」「公開（Publish/予約実行）」「復元」の3トリガでのみ刻み、Autosave 自体は Revision を刻まない（下書きバッファのみ更新）。
- 復元（restore）は「過去 Revision の内容で新しい Revision を追記し `episodes.body` を更新する」操作とし、履歴を巻き戻さない（上書きしない原則、PRD §12）。
- Autosave は `PATCH /novels/:novelId/episodes/:episodeId/draft` で下書き専用フィールドを更新する。競合検知は **`updated_at` ベースの楽観ロック**（If-Unmodified-Since 相当）を採用し、破壊的上書きを防ぐ。
- Scheduled Publish は `scheduled_publishes` テーブル + `worker`（infrastructure §3.2）による due ポーリング実行とし、初期実装は cron 相当のポーリング、将来はジョブキューへ移行可能な形にする。
- 文字数（`char_count`）は「本文中の記法マーカーを除いた実表示文字数」を正とし、Editor・Preview・DB のカウント関数を単一ロジックに統一する。

---

## 1. Episode ライフサイクルの軸整理

PRD §7–9, §11–12 に基づき、Episode は 3 つの独立した軸を持つ。

| 軸 | 値 | 決定する主体 | 備考 |
|---|---|---|---|
| **Episode Status**（公開段階） | `draft` / `published` | 著者操作（Publish/Unpublish） | Episode 固有。Novel の Visibility とは別（[data-model.md](../foundation/data-model.md) `episodes.status`） |
| **Visibility**（閲覧範囲） | `public` / `unlisted` / `private` / `NULL`(継承) | 著者操作（個別上書き、既定は Novel 継承） | PRD §9。`episodes.visibility` が NULL のときは Novel の Visibility に従う |
| **Publication Status**（作品全体の進行度） | `ongoing` / `completed` / `hiatus` | Novel 単位（著者が明示的に設定） | PRD §8。Episode の draft/published とは無関係。「連載中でも最新話が draft」は普通に起こる |

**決定 / 理由 / 代替案**
- 決定: Episode Status（draft/published）を Visibility とは別カラムに持つ（[data-model.md](../foundation/data-model.md) で既に採用）。
- 理由: PRD §8 は「Draft は Novel の状態ではなく Visibility で表現する」と明言するが、これは Novel レベルの話。Episode 単位では「Public な作品の中の未公開話」という状態が必須（連載の通常運用）であり、Visibility だけでは表現できない。
- 代替案: Episode にも Visibility の一種として `draft` を持たせる案は、Public Novel 配下の Episode で Visibility が矛盾する（Novel=public なのに Episode=draft/private 相当が別軸で重複表現になる）ため不採用。

### 1.1 状態遷移図（Episode Status × 予約公開）

```text
                     ┌────────────────────────────┐
                     │                            │
                     ▼                            │
   [作成] ──▶ (draft) ──Publish───────────▶ (published)
                  │  ▲                         │  │
                  │  │                         │  │
                  │  └──────Unpublish──────────┘  │
                  │                               │
                  │ Schedule Publish              │ Unpublish
                  ▼                               ▼
           (draft, scheduled_publishes:pending)  (draft)
                  │                               ▲
                  │ due 到達（worker実行）         │
                  ├──────────────▶ (published) ───┘
                  │
                  │ Cancel Schedule
                  ▼
               (draft)
```

- **draft → published（即時 Publish）**: `episodes.status = 'published'`、`published_at = now()` を設定し、公開用 Revision を1件追記する（§2.2）。
- **draft → scheduled（Schedule Publish）**: `episodes.status` は `draft` のまま、`scheduled_publishes` に `(episode_id, scheduled_at, status='pending')` を1件作成（`UNIQUE(episode_id)` により1 Episode 1 予約）。
- **scheduled → published（due 到達）**: worker が `scheduled_publishes` を `status='done', executed_at=now()` に更新し、対象 Episode を Publish と同じ手順で `published` にする（§4）。
- **scheduled → draft（Cancel Schedule）**: `scheduled_publishes.status = 'canceled'` にし、Episode は `draft` のまま。
- **published → draft（Unpublish）**: `episodes.status = 'draft'` に戻す。`published_at` は**保持**する（初回公開日時の記録として使うため、再公開時に上書きしない。再公開時の扱いは §1.2）。
- **Visibility 変更**は Episode Status とは独立に、いつでも行える（draft/published どちらの状態でも Visibility を変更可能）。ただし `draft` Episode は Visibility の値に関わらず「未公開」として扱い、Owner/権限を持つ Collaborator 以外には見せない（サーバ側認可、[auth.md](../foundation/auth.md)）。

### 1.2 Unpublish 後の再 Publish

- `published_at` は「初出時刻」を保持する方針（決定）。理由: 読者の「更新順」表示や Analytics の初出計測が Unpublish/再 Publish で歪まないようにするため。
- 再 Publish 時に `published_at` を更新したいユースケース（大幅改稿の告知等）は、Novel/Episode の「更新日時」表示に別途 `updated_at`（`timestamps` 共通カラム）を使う。`published_at` は初出、`updated_at` は最終更新、と役割を分離する。
- 代替案: Unpublish→Publish のたびに `published_at` を更新する案は、連載作品で「最新話一覧」が Unpublish 操作で意図せず入れ替わる副作用があるため不採用。

### 1.3 権限との関係（要点のみ、詳細は collaboration-fork.md）

| 操作 | 必要な Role（最小） |
|---|---|
| Draft 保存（Autosave/手動保存） | Writer 以上 |
| Publish / Unpublish / Scheduled Publish | Admin 以上（Owner/Admin）。PRD §13 の Role 定義上、Writer は「Draft保存」まで、Publish 権限は Admin/Owner のみ |
| Revision 作成（保存操作に付随） | Editor 以上（PRD §13「Editor: Episode編集・Revision作成」） |
| Revision 閲覧・Restore | Admin/Owner（Restore は実質 Publish 相当の破壊力を持つため、Editor には許可しない） |
| Draft Episode の閲覧 | Viewer 以上（Novel への Collaborator 権限を持つ全 Role） |

PRD §13 の Role テーブルは Writer に「Publish」を含めていないため、本書では Publish 系操作を Admin 以上に限定する（実装時の認可チェックはサーバ側、[auth.md](../foundation/auth.md) の Role マトリクスを正とする）。

---

## 2. Revision システム

### 2.1 保存方式: 全文スナップショット（決定）

| | 全文スナップショット（採用） | 差分（delta）チェーン |
|---|---|---|
| 復元の容易さ | O(1)、常に対象 Revision の `body` をそのまま `episodes.body` にコピーするだけ | 先頭からの再生 or 逆再生が必要。壊れた1差分が以降全てを巻き込む |
| 差分表示 | 2つの Revision の `body` を都度 diff アルゴリズム（行/文字単位）で計算すれば良い | 保存済み差分をそのまま出せるが、任意の2点間 diff には結局再計算が要る |
| 容量 | Episode 本文は数 KB〜数十 KB程度（PRD想定の小説本文）× Revision数。実用上問題になりにくい | 小さい |
| 実装単純さ | 高い（追記のみ） | 低い（マージ、破損耐性、順序保証が必要） |
| 決定 | **採用** | 不採用（将来、古い Revision の圧縮/差分化への切替は「未決事項」参照） |

`episode_revisions` は [data-model.md](../foundation/data-model.md) の定義を正とする（再掲・要約）:

```ts
episode_revisions {
  id, episode_id, editor_id, revision_no,
  title, body, char_count,
  change_note,          // nullable。変更メモ（PRD §12）
  restored_from_id,     // nullable。復元で作られた Revision の場合、元 Revision を指す
  created_at
}
```
- `UNIQUE(episode_id, revision_no)` で履歴順序を保証。`revision_no` は Episode 内で 1 始まりの連番。
- **UPDATE/DELETE しない（append-only）**。復元も「新規追記」のみで実現する（§2.3）。

### 2.2 Revision を刻むタイミング

| トリガ | Revision 作成 | `episodes.body` 更新 | 備考 |
|---|---|---|---|
| Autosave（一定間隔/変更検知） | **しない** | しない（下書きバッファのみ、§3） | Revision を乱発すると履歴が読みづらくなるため除外 |
| 手動保存（ユーザーが明示的に「保存」を押す） | する | する | Editor 上の「保存」ボタン操作 |
| Publish（Draft→Published、予約実行含む） | する | する | 公開時点のスナップショットを必ず1件残す |
| Restore（過去 Revision の復元） | する（`restored_from_id` 付き） | する | §2.3 |
| Unpublish | **しない** | しない | 内容変更を伴わない状態遷移のため |
| Visibility 変更 | しない | しない | 内容変更ではない |

- 理由: 「何を Revision として刻むか」を絞ることで、意味のある変更点（ユーザーが意図的に保存した/公開した/復元した瞬間）だけが履歴に残り、Revision History UI（[frontend.md](../overview/frontend.md) §5）が読みやすくなる。
- 手動保存の連打で Revision が増えすぎる懸念に対しては、直前 Revision と `body` が完全一致する場合は新規 Revision を作らない（no-op 保存の除外）。

### 2.3 復元（Restore）

1. 対象 `episode_revisions` レコード（`restore_target`）を取得。
2. 新しい Revision を追記: `revision_no = MAX(revision_no)+1`、`title/body/char_count` は `restore_target` の値をコピー、`restored_from_id = restore_target.id`、`editor_id` は復元操作を行ったユーザー。
3. `episodes.body`, `episodes.title`（Revision に title を含むため両方復元対象）, `episodes.char_count` を新 Revision の値で更新。
4. Episode Status（draft/published）自体は変更しない。**published な Episode を過去内容へ復元しても、読者に見えている本文が即座に切り替わる**点をUIで明示する（意図しない巻き戻りを防ぐ確認ダイアログを必須にする、[frontend.md](../overview/frontend.md) 側の責務）。
5. 復元操作自体は「上書き」ではなく「復元という名の新規保存」であるため、履歴を遡っても過去の `episode_revisions` 行は一切変更されない（append-only 原則の維持）。

### 2.4 差分表示（Diff）

- 保存方式が全文スナップショットのため、任意の2 Revision 間（または「現在の `episodes.body`」と任意 Revision の間）の diff は **表示時に都度計算**する。
- アルゴリズム: 行単位（段落単位）の LCS ベース diff（Myers 系）を第一候補とする。プレーンテキストで改行区切りの構造が明確なため、行単位で十分な可読性が得られる。
- 文字単位 diff は将来オプション（1行が長文になりがちな縦書き小説では行単位のほうが読みやすいと想定、UI検証が必要 → 未決事項）。
- 差分計算ロジックは `domain/writing/services/` に Domain Service として置き、Revision History View と Change Proposal（[collaboration-fork.md](./collaboration-fork.md) の `base_revision_id` diff、PRD §16）から共通利用する。

### 2.5 編集者（Collaborator）との紐付け

- `episode_revisions.editor_id` は実際にその Revision を作成した Collaborator の `user_id`（PRD §12「Editor User ID」）。
- Owner/Admin が退会・Role 剥奪されても、`editor_id` は `ON DELETE RESTRICT`（[data-model.md](../foundation/data-model.md)）により履歴上の帰属を失わない。ユーザー物理削除自体を許可しない設計と整合。
- Revision History UI では「誰が」「いつ」「(あれば) change_note」を一覧表示する（[frontend.md](../overview/frontend.md) §5 に UI詳細）。

---

## 3. Autosave 契約

### 3.1 エンドポイント

```
PATCH /novels/:novelId/episodes/:episodeId/draft
```

- Controller: `EpisodeDraftController`（Presentation, thin）。
- Application Service: `SaveEpisodeDraftService`（Use Case）。
- Domain: `Episode` エンティティの `updateDraftContent()` を呼ぶのみ。Revision は作らない（§2.2）。

**Request（例）**
```json
{
  "title": "第3話 嵐の夜",
  "body": "｜文章《ルビ》...",
  "clientUpdatedAt": "2026-09-16T10:22:31.000Z"
}
```

**Response（成功）**
```json
{
  "status": "saved",
  "savedAt": "2026-09-16T10:22:33.512Z",
  "charCount": 1842,
  "conflict": false
}
```

**Response（競合検知時、409）**
```json
{
  "status": "conflict",
  "serverUpdatedAt": "2026-09-16T10:21:50.000Z",
  "serverTitle": "第3話 嵐の夜（Bob編集中）",
  "serverBody": "..."
}
```

### 3.2 保存粒度

- **フィールド単位ではなく `title` + `body` をまとめて1回の PATCH で送る**（Episode の下書きは単一の編集対象であり、部分更新の複雑さに見合うメリットが薄いため）。
- 送信タイミングは island 側の責務（[frontend.md](../overview/frontend.md) §5）: デバウンス（例: 入力停止後 2〜3秒）+ 定期フォールバック（例: 30〜60秒ごと）+ 離脱前（`beforeunload`/タブ非表示）に best-effort 送信。
- 本エンドポイントは `episodes.title` / `episodes.body` / `episodes.char_count` / `episodes.updated_at` のみを更新し、**Revision・Publish 状態には触れない**。

### 3.3 競合検知・解決方針

Episode は複数 Collaborator（Writer/Editor 以上）が同時編集しうる（PRD §13）。

- **決定: 楽観ロック（optimistic concurrency）を `updated_at` タイムスタンプで実装。** リクエストに `clientUpdatedAt`（クライアントが最後に取得した `episodes.updated_at`）を含め、サーバ側で現在の `episodes.updated_at` と比較する。
  - 一致（またはクライアントが最新版から編集を始めている）→ 保存を許可し、`updated_at` を更新。
  - 不一致（サーバ側が別の保存で先に進んでいる）→ **409 Conflict** を返し、上書きしない。クライアントは差分をユーザーに提示し、「自分の変更を優先して上書き保存」「サーバ側の内容を取り込む」のいずれかを選ばせる（UI詳細は frontend 側）。
- 理由: Episode 本文は単一ユーザーが主に書く想定（Google Docs的なリアルタイム共同編集は PRD スコープ外）であり、真の CRDT/OT 型リアルタイムマージは過剰投資。楽観ロックで「気づかず上書きしてしまう」事故さえ防げれば十分。
- 代替案: 悲観ロック（編集開始時に lock 取得、他者は読み取り専用になる）は将来オプション。Editor Role が複数人いる共同執筆ニーズが実際に強ければ再検討（未決事項）。
- **明示的な「保存」操作（手動保存、Revision を刻む）でも同じ 409 Conflict の仕組みを使う。** 手動保存時に競合していれば、Revision作成前に必ず解決させる（競合したまま Revision を刻まない）。

### 3.4 保存状態の返却とUI連携

- Autosave 成功時は `savedAt` と `charCount` を返し、island 側が「保存済み HH:mm:ss」「◯◯文字」を表示する（UI実装は [frontend.md](../overview/frontend.md) §5、本書は契約のみ規定）。
- 保存失敗（ネットワークエラー等）はクライアント側でリトライキューに積み、次の成功保存まで「未保存の変更があります」を表示する方針とする（詳細UXは frontend 側）。

---

## 4. Draft / Publish / Scheduled Publish の実装

### 4.1 Publish（即時公開）

```
POST /novels/:novelId/episodes/:episodeId/publish
```
1. 認可: Role が Admin 以上か検証（§1.3）。
2. 未保存の下書き内容と現在の `episodes.body` に差分があれば、まず手動保存と同じ手順で Revision を1件作る（§2.2）。
3. `episodes.status = 'published'`、`published_at`（初出時のみ set、§1.2）を更新。
4. Publish 用の Revision を追記（既に手順2で作成済みならそれを流用し、二重には刻まない）。
5. Analytics には Publish イベントは含めない（`analytics_events` は読者行動イベントが主、PRD §36。Publish は transactional 側の状態変更として記録）。

### 4.2 Unpublish

```
POST /novels/:novelId/episodes/:episodeId/unpublish
```
- `episodes.status = 'draft'` に戻すのみ。`published_at` は保持（§1.2）。Revisionは刻まない。

### 4.3 Scheduled Publish

```
POST   /novels/:novelId/episodes/:episodeId/schedule    { scheduledAt }
DELETE /novels/:novelId/episodes/:episodeId/schedule     // 予約キャンセル
```

- `scheduled_publishes` に `UNIQUE(episode_id)` 制約があるため、既存の予約がある場合は「更新」として扱う（既存行の `scheduled_at` を更新、または一度キャンセルしてから作り直す）。
- **実行主体**: `worker` コンテナ（[infrastructure.md](../overview/infrastructure.md) §3.2）が定期的に `scheduled_publishes WHERE status='pending' AND scheduled_at <= now()`（`(status, scheduled_at)` インデックス使用）を due 抽出し、Publish 処理（§4.1 と同等の Application Service `PublishEpisodeService` を worker からも呼び出す）を実行後、`status='done', executed_at=now()` に更新。
- **初期実装**: 独立 worker プロセスを最初から用意せず、Bun の `setInterval`（アプリプロセス内ポーリング、例: 1分間隔）または cron 相当のポーリングで代替可（PRD §54, data-model.md 備考「初期は起動時/リクエスト時ポーリングでも可」）。将来アクセス増加時に `worker` サービスへ切り出す。
- **冪等性**: due 抽出→実行→`status='done'` の一連をトランザクション内で行い（`SELECT ... FOR UPDATE` または `UPDATE ... WHERE status='pending' RETURNING`）、複数 worker インスタンスが同時稼働しても二重公開を防ぐ。
- **失敗時**: Publish 処理が例外を起こした場合は `status` を `pending` のまま残し、次回ポーリングで再試行する（リトライ上限・アラートは運用フェーズで検討、未決事項）。
- Application Service 構成:
  ```
  domain/writing/
  ├ entities/          episode.ts / episode-revision.ts / scheduled-publish.ts
  ├ value-objects/      episode-status.ts / char-count.ts
  ├ repositories/       episode-repository.ts / episode-revision-repository.ts / scheduled-publish-repository.ts  ← interface
  ├ services/           revision-diff-service.ts（§2.4）
  └ errors/

  application/services/
  ├ save-episode-draft-service.ts     … Autosave/手動保存（§3, §2.2）
  ├ publish-episode-service.ts        … Publish（即時・予約実行共通、§4.1）
  ├ unpublish-episode-service.ts
  ├ schedule-episode-publish-service.ts
  └ restore-episode-revision-service.ts  … Restore（§2.3）
  ```

### 4.4 文字数カウントの定義

- **決定**: `char_count` は「記法マーカーを除いた実表示文字数」とする。具体的には、ルビ記法 `｜文章《ルビ》` はルビ部分（`《ルビ》`と区切り文字`｜`）を除いた「文章」のみをカウントし、傍点記法 `《《文章》》` は区切り記号（`《《` `》》`）を除いた「文章」のみをカウントする。改行文字は文字数に含めない（読者向けの「本文の長さ」感覚に合わせるため）。
- 理由: 執筆者が気にするのは「読者が読む分量」であり、記法のための制御文字を含めると水増しされ、他作品との比較や進捗管理の指標として不正確になる。
- カウントロジックは記法変換と対になるため [text-notation.md](./text-notation.md) にパーサ実装を集約し、`domain/writing` 側のカウント関数はそのパーサの「プレーン文字列化」結果に対して `Array.from(str).length`（サロゲートペア対応）を適用する形で共通化する。
- `char_count` は `episodes`（現在の本文）と `episode_revisions`（各スナップショット時点）の両方に保持し、Autosave 保存時・Revision 作成時に同一関数で都度再計算する（denormalize、[data-model.md](../foundation/data-model.md) 準拠）。
- Novel 単位の合計文字数（`novels.total_char_count`、[data-model.md](../foundation/data-model.md)）は **公開済み（`status='published'`）Episode の `char_count` 合計**のみを対象とする。Draft の文字数は作者本人の Editor 画面にのみ表示し、公開集計・検索/ソートには含めない。

---

## 5. 未決事項

1. **Revision の長期保存戦略**: 全文スナップショットは実装単純だが、長期運用で1 Episode に数百 Revision が蓄積した場合の容量・一覧表示パフォーマンス。古い Revision（例: 直近N件以外）を圧縮 or 間引く/差分化するしきい値は未決（[data-model.md](../foundation/data-model.md) にも同様の未決事項あり）。
2. **Diff の粒度**: 行単位 diff で確定するか、縦書き・長文段落を想定した文字単位 diff や文単位 diff を UI検証の上で採用するかは未決。
3. **編集競合の解決UI**: 楽観ロックで 409 を返す設計は確定だが、実際の「マージ支援 UI」（両者の差分を並べて手動マージさせる/自動マージを試みる）の詳細は frontend 側で別途検討。
4. **悲観ロック（編集中ロック表示）の要否**: 複数 Collaborator が同一 Episode を頻繁に同時編集する運用が実際に多いなら、`draft` 編集開始時に「編集中: @handle」を表示するプレゼンス機能の追加を検討（realtime 基盤の要否含め未決）。
5. **Scheduled Publish の失敗時リトライ・通知**: 実行失敗時のリトライ上限、著者への失敗通知（[social-notification.md](./social-notification.md) 連携）の要否は未決。
6. **Change Proposal（PRD §16）との Revision 統合度**: Change Proposal 受理（Accept）時に生成される Revision と、通常の Publish/Restore で生成される Revision を UI 上でどう区別表示するか（`restored_from_id` に相当する `proposal_id` 的な出自カラムの追加要否）は [collaboration-fork.md](./collaboration-fork.md) 側の検討と合わせて未決。
