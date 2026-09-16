# Collaboration & Fork Design / 共同制作・Fork 設計

> 対象: Collaboration（共同制作・Role・招待）と Fork / Change Proposal（GitHub-Fork 型の派生作品）。ReNovel の看板差別化機能（PRD §5 "Collaboration Is Native"）。
> 正典は PRD §5, §13, §14, §15, §16。テーブル定義の正典は [data-model.md](./data-model.md)（`collaborators` / `collaboration_invitations` / `forks` / `change_proposals` / `change_proposal_comments`）。Role 権限マトリクスの正典は [auth.md](./auth.md) §3.1（本書はそれを前提にコラボレーション固有のフロー・状態遷移を補う。マトリクス自体は再定義しない）。
> Revision の保存方式・Episode ライフサイクルは [writing-revision.md](./writing-revision.md) を正典とし、本書はそこに Collaboration/Fork 固有の紐付けを追加する。ルート一覧は [routing.md](./routing.md) §3.3 を正とし、本書は該当ルートを引用する。
> 現状は scaffold（Phase 0 完了）。本書は「これから作る目標形」を示す。

## サマリー

- **招待は `collaboration_invitations` を経由する非同期フロー**とし、招待中は `collaborators` 行を作らない（承諾して初めて Role が確定する）。二重招待は部分 UNIQUE index で防止し、招待の状態遷移（pending → accepted/declined/revoked/expired）を明確化する。
- **Owner 移譲は「新 Owner 昇格 → 旧 Owner 降格」の順で必ず 2 段トランザクションで行う**。部分 UNIQUE index（`role='owner'` は Novel あたり1行）を瞬間的にも破らないよう、降格を先に実行してから昇格させる。
- **Fork の帰属表示は DB に「編集可能なテキスト」として保存しない。** `forks.source_novel_id` を辿って毎回動的生成し、`forks` テーブルは DB トリガで UPDATE/DELETE を拒否する append-only とする。Novel 設定更新 API のリクエストスキーマは allow-list 方式で帰属関連フィールドを一切受け付けないため、UI 経由でもサーバ経由でも削除不可能にする（DB 制約 + サーバ側検証の二重化）。
- **Fork Policy が `approval_required` の場合、`forks` に直接書かず新設の `fork_requests` テーブル（本書提案、[data-model.md](./data-model.md) への追記が必要）で承認待ちを表現する。** `collaboration_invitations` と対称的なパターンにし、承認された時点で初めて `forks` 行と新 Novel が生成される。
- **Change Proposal の Accept は「新しい `episode_revisions` を1件追記する」操作として `writing-revision.md` の Revision 体系に統合する。** 誰の版かを明確にするため `editor_id = 提案者`、かつ出自を追跡する `episode_revisions.source_proposal_id`（本書提案、新規列）を追加し、Restore（`restored_from_id`）と対称に扱う。これは writing-revision.md §5 未決事項5を本書で確定するものである。
- **Change Proposal の提案元は「Fork 由来」（`source_novel_id` あり）と「共同制作内」（`source_novel_id` NULL）の2パターンがあり、後者は Viewer ロールにも開放する** — 編集権限を持たない Collaborator（ベータリーダー的な立場）が直接編集せずに変更を提案できるようにするための設計判断。

---

## 1. Collaboration — 招待から参加までのライフサイクル

### 1.1 前提: Role と権限

Role（`collaborator_role`: `owner`/`admin`/`writer`/`editor`/`viewer`）ごとの操作可否は [auth.md](./auth.md) §3.1 の権限マトリクスを正典とする。本書では重複記載せず、コラボレーション運用上の要点のみ再掲する。

| Role | 一言で | Revision との関係 |
|---|---|---|
| Owner | 全権限・Novel の責任者。`novels.author_id` と一致 | 自身の保存操作は `editor_id=自分` の Revision を残す |
| Admin | 設定変更・Collaborator 管理・Publish 可 | 同上 |
| Writer | Episode 作成・編集・Draft 保存可 | 同上 |
| Editor | 既存 Episode の校正・編集のみ（新規 Draft 作成不可、[auth.md](./auth.md) §3.1 脚注） | 校正結果が Revision の `editor_id` に残る |
| Viewer | Private Novel / Draft Episode の閲覧のみ | Revision を作れない。Change Proposal（§3.2）でのみ変更を提案可能 |

### 1.2 招待の状態遷移

招待は `collaboration_invitations`（[data-model.md](./data-model.md)）の `invitation_status` enum で管理する。

```text
                    ┌────────────┐
        招待作成 ──▶│  pending   │
                    └─────┬──────┘
                          │
        ┌─────────────────┼─────────────────┬───────────────────┐
        │ 招待対象が承諾    │ 招待対象が辞退    │ Owner/Admin が取消 │ 期限切れ(worker)
        ▼                 ▼                 ▼                   ▼
   ┌──────────┐     ┌───────────┐     ┌──────────┐       ┌──────────┐
   │ accepted │     │ declined  │     │ revoked  │       │ expired  │
   └────┬─────┘     └───────────┘     └──────────┘       └──────────┘
        │
        ▼
  collaborators 行を1件 INSERT
  （novel_id, user_id=invitee_id, role, invited_by=inviter_id）
```

- **pending → accepted/declined**: 招待対象本人のみが遷移させられる（`POST /api/invitations/{invitationId}/accept` / `decline`、[routing.md](./routing.md) §3.3）。`responded_at` を記録。
- **pending → revoked**: 招待した側（Owner/Admin）がまだ pending の招待を取り消す。招待対象が既に accepted 後は取り消せない（Collaborator 削除は別操作、§1.1 の権限で `DELETE /api/studio/collaborators/{collaboratorId}`）。
- **pending → expired**: 招待発行から一定期間（既定 14 日、未決事項）応答がない場合に期限切れとする。実装は [writing-revision.md](./writing-revision.md) の Scheduled Publish と同じ due ポーリング worker パターンを流用可能（軽量なので当面はリクエスト時 lazy 評価でも可）。
- **一意性**: 同一 Novel × 同一 invitee に対する pending 招待は同時に1件のみ（`UNIQUE(novel_id, invitee_id) WHERE status='pending'`、[data-model.md](./data-model.md)）。過去に declined/revoked/expired になった招待は再招待可能（新しい行を作る。append-only ではなく通常の状態更新表）。
- **accepted は取り消し不能**: 一度 accepted になった `collaboration_invitations` 行はステータスを戻さない。Collaborator を外す操作は `collaborators` 行の DELETE として別途行う（招待履歴と現在の在籍状態を分離する）。

### 1.3 招待〜参加のシーケンス

```text
Owner/Admin                     System                          Invitee
    │  POST .../collaborators/invitations                          │
    │  { inviteeHandle or inviteeId, role }                         │
    ├──────────────────────────▶ InviteCollaboratorService          │
    │                                │ 1. Role=Owner/Admin か検証     │
    │                                │ 2. 既存 collaborators 重複チェック│
    │                                │ 3. pending 招待重複チェック      │
    │                                │ 4. collaboration_invitations INSERT│
    │                                │ 5. notification(collaboration_invite)│
    │                                └───────────────────────────────▶│
    │                                                          GET /me/invitations
    │                                                                 │
    │                                          POST /api/invitations/{id}/accept
    │                                ┌────────────────────────────────┤
    │                                │ RespondInvitationService        │
    │                                │ 1. invitee本人か検証             │
    │                                │ 2. status='pending' か検証       │
    │                                │ 3. status='accepted', responded_at│
    │                                │ 4. collaborators INSERT（トランザクション同一）│
    │                                │ 5. notification(Owner/Admin へ「参加」通知)│
    │◀───────────────────────────── 完了 ─────────────────────────────┘
    │  Studio の Collaborator 一覧に反映
```

- ステップ「招待作成」と「Collaborator 行 INSERT」を**分離**することで、招待時点ではまだ相手の同意がない状態を正しく表現する（PRD の「招待→承諾/辞退→参加」の3段階を素直に反映）。
- 招待受諾の INSERT は `collaboration_invitations` の UPDATE と同一トランザクションで行い、承諾したのに `collaborators` 行が作られない不整合を防ぐ。
- Application Service 構成:
  ```
  domain/collaboration/
  ├ entities/            collaborator.ts / collaboration-invitation.ts
  ├ value-objects/        collaborator-role.ts
  ├ repositories/         collaborator-repository.ts / invitation-repository.ts  ← interface
  ├ services/             collaborator-policy.ts（auth.md §4.1 に既出）
  └ errors/

  application/services/
  ├ invite-collaborator-service.ts
  ├ respond-invitation-service.ts     … accept/decline 共通
  ├ revoke-invitation-service.ts
  ├ change-collaborator-role-service.ts
  ├ remove-collaborator-service.ts
  └ transfer-owner-service.ts          … §1.5
  ```

### 1.4 Role と Revision の紐付け（誰の版か）

- `episode_revisions.editor_id` は「その Revision を実際に保存操作した Collaborator の `user_id`」（PRD §12「Editor User ID」、[writing-revision.md](./writing-revision.md) §2.5 が正典）。Collaboration の観点で追加すべき規則は以下。

| 事象 | `editor_id` への影響 |
|---|---|
| Writer A が Draft を保存 | `editor_id = A` の Revision が刻まれる（手動保存時のみ、Autosave では刻まれない） |
| Editor B が A の原稿を校正して保存 | `editor_id = B`。A の元原稿は過去 Revision として残るため「誰が何を書いたか」が Revision 履歴から追跡できる |
| A が Role を剥奪され Collaborator から外れた後 | 過去に A が刻んだ Revision の `editor_id=A` は変更しない（`ON DELETE RESTRICT` により `users` 物理削除時も破棄されない、[data-model.md](./data-model.md) §1.4）。Revision History UI 上は「元 Collaborator」等の注記を付けて表示する（UI詳細は [frontend.md](./frontend.md) 側） |
| Role が Viewer に降格された Collaborator が過去に持っていた Revision | そのまま保持。降格は将来の保存権限のみに影響し、過去の履歴的事実は変えない |

- **決定 / 理由 / 代替案**: Revision の帰属は「保存操作した本人」を常に正とする（提案の取り込み時のみ例外、§3.5 で別途規定）。理由は Revision History が「実際に誰の手でその文面になったか」という編集監査ログとしての役割を持つため（共同制作の透明性、PRD §5 "Collaboration Is Native"）。代替案として「Owner 名義に統一する」案は監査価値を失うため不採用。

### 1.5 Owner 移譲

Owner は 1 Novel に必ず 1 名（`collaborators` の部分 UNIQUE index `WHERE role='owner'`、[data-model.md](./data-model.md)）。Owner 不在の瞬間を作らずに移譲するため、**2段階トランザクション**を採用する。

```
POST /api/studio/novels/{novelId}/transfer-owner
Body: { newOwnerUserId }
```
（新規ルート提案。[routing.md](./routing.md) の Collaboration 節に追記が必要）

**決定 / 理由 / 代替案**

| | 内容 |
|---|---|
| **決定** | 移譲先は**既に `collaborators` に在籍しているユーザーに限定**する（招待→承諾を経ていない相手にはいきなり Owner を渡さない）。単一トランザクション内で ①旧 Owner を `admin` に降格 → ②新 Owner を `owner` に昇格 → ③ `novels.author_id` を新 Owner に更新、の**この順序**で実行する。 |
| **理由** | `collaborators` には「Novel あたり `role='owner'` は1行」という**部分 UNIQUE index**があり、これは UPDATE 文単位で即時検証される（Postgres の部分 unique index は `DEFERRABLE` にできない）。もし先に新 Owner を `owner` に昇格させると、旧 Owner がまだ `owner` のままの瞬間に2行の `owner` が同時存在し、index 違反で例外になる。**降格を先に行う**ことでこの矛盾を避ける。また「既存 Collaborator にのみ移譲可能」とすることで、権限委譲の相手が事前に Novel の内容・責任を把握している状態を担保する（面識のない第三者へ突然全権が渡る事故を防ぐ）。 |
| **代替案** | (a) 一時的に「Owner 不在」を許容し2ステップの独立 UPDATE にする — 部分 index 違反はしないが、途中で例外が起きた場合に Owner 不在 Novel が生まれるリスクがあり不採用。(b) `collaborators` に招待していない外部ユーザーへ直接移譲 — Fork の帰属のように「同意なき責任移転」になり、受け取り側が心構えのないまま Owner 権限（Novel 削除含む）を持つことになるため不採用。移譲したい場合は先に通常の招待フローで Collaborator化してから移譲する2段運用とする。 |

```ts
// application/services/transfer-owner-service.ts（スケッチ）
export class TransferOwnerService {
  async execute(input: { actorUserId: string; novelId: string; newOwnerUserId: string }) {
    return this.db.transaction(async (tx) => {
      const actorRole = await this.collaborators.findRole(tx, input.novelId, input.actorUserId);
      if (actorRole !== "owner") throw new ForbiddenError(); // Owner本人のみ実行可

      const targetRole = await this.collaborators.findRole(tx, input.novelId, input.newOwnerUserId);
      if (targetRole === null) throw new NotFoundError(); // 未在籍者への直接移譲は不可

      // ① 降格を先に実行（部分 unique index 違反を避ける）
      await this.collaborators.updateRole(tx, input.novelId, input.actorUserId, "admin");
      // ② 昇格
      await this.collaborators.updateRole(tx, input.novelId, input.newOwnerUserId, "owner");
      // ③ novels.author_id を同期
      await this.novels.updateAuthor(tx, input.novelId, input.newOwnerUserId);

      await this.notifications.notifyOwnershipTransferred(tx, { novelId: input.novelId, from: input.actorUserId, to: input.newOwnerUserId });
    });
  }
}
```

- Fork Policy の変更権限は Owner のみ（[auth.md](./auth.md) §3.1 補足）なので、移譲直後から新 Owner がその権限を持つ。旧 Owner は Admin として Novel 削除以外の権限を保持し続ける。

---

## 2. Fork — 派生作品モデル

### 2.1 系譜モデル（source / forked / root）

`forks`（[data-model.md](./data-model.md)）が系譜の正典。

| 列 | 意味 |
|---|---|
| `source_novel_id` | 直接の派生元（1段上の親）。非 unique（1つの原作から複数 Fork が可能） |
| `forked_novel_id` | 生成された派生作品。**unique**（1 Novel は高々1つの by-fork origin を持つ = 二重 fork 元は持てない） |
| `root_novel_id` | 系譜の一番上（多段 Fork の場合、最初のオリジナル）。集計高速化のための denormalize |

**`root_novel_id` の算出式（Fork 作成時）**:

```
root_novel_id(newFork) =
  if source_novel は他 Novel からの fork である場合（= source_novel_id で forks を引ける）:
      その forks 行の root_novel_id をそのまま引き継ぐ
  else:
      source_novel_id 自身（source が正真正銘のオリジナル）
```

- **決定 / 理由 / 代替案**: `root_novel_id` を都度再帰 CTE で辿らず**書き込み時に確定して denormalize**する。理由は「このオリジナルから何段でも派生した作品が合計何件あるか」のような系譜全体の集計（将来の Fork 統計・discovery.md のランキング補正候補）を `WHERE root_novel_id = X` の単純クエリで済ませるため（PRD §55 の N+1/重い動的計算回避方針と整合）。**直近の親子関係（パンくず表示用の「Forked from: 直接の親」）は `source_novel_id` を辿るだけで十分**であり、`root_novel_id` は全体集計専用。代替案（都度再帰 CTE）は Fork 段数が深くなるほど遅くなるため不採用（実際は数段以上深くなることは稀だが、原作側の「累計フォーク数」表示に効くため採用）。

### 2.2 多段 Fork の系譜図

```text
        「神は勇者を選ばない」(Novel A)  ← root
                 │ fork
                 ▼
        「勇者を選ばなかった神」(Novel B)
           source_novel_id = A
           root_novel_id   = A
                 │ fork
                 ▼
        「選ばれなかった勇者の逆襲」(Novel C)
           source_novel_id = B   ← 直接の親は B
           root_novel_id   = A   ← 系譜のルートは常に A
```

- Novel C の閲覧画面には「Forked from: 勇者を選ばなかった神（さらにその原作: 神は勇者を選ばない）」のように**直接の親のみ既定表示**し、深い系譜は折りたたみ表示にする（UI詳細は [frontend.md](./frontend.md) 側の検討事項）。**直接の親の帰属だけは常に必須表示**とし、ルートまでの完全な系譜表示は補足情報という扱いにする（PRD §14 の例示「Forked from: 「神は勇者を選ばない」」は直接の親を指すため）。
- 原作側 Novel A の「Fork 一覧」（PRD §14「原作側でもFork一覧を確認可能」）は `source_novel_id = A` の直接の子のみを列挙する（孫以降は含めない。孫まで見たい場合は各子ページから辿る設計とし、無限ツリー描画をページ内に持ち込まない）。

### 2.3 Fork 実行フロー（コピー範囲・初期状態）

```
POST /@{handle}/{slug}/fork
```
（[routing.md](./routing.md) §3.3。SSR フォーム送信、成功後は新 Novel の Studio 編集画面へリダイレクト）

**コピーする/しないものの決定**

| 対象 | Fork 時の扱い | 理由 |
|---|---|---|
| Novel メタデータ（title, genre, description, content_warnings, tags） | コピーする（title は "（Fork）" 等の既定サフィックスを付け、Owner が Studio 側でリネーム可能にする） | 派生の出発点として読者が迷わないようにする |
| Chapter 構成 | コピーする（`order_index` も踏襲） | 目次構造の再現 |
| **公開済み（`status='published'`）Episode の本文** | コピーする。新 Novel 側で `episode_revisions` に `revision_no=1` として新規追記（**Fork 元の Revision 履歴は引き継がない**、新しい歴史として始まる） | 派生作品は自分自身の編集履歴を持つべきで、原作の Revision 履歴をそのまま引き継ぐと `editor_id` が原作者のままの履歴が別 Novel に混入し誤解を招く |
| **Draft（未公開）Episode** | **コピーしない** | 未公開内容は原作の Collaborator 以外に見せてはいけない情報であり、Fork は「公開されている作品」に対する操作（Fork Policy も Public 前提、§2.4） |
| Collaborator 一覧 | コピーしない。新 Novel の Collaborator は fork 実行者のみ（`owner`） | 派生作品の共同制作体制は派生元と独立に組む |
| Like/Star/Review/Follow カウンタ | コピーしない（0 から開始） | 派生作品は別作品として評価される。原作の評価を騙って見せない |
| `fork_policy` | コピーしない。新 Novel は既定値 `disabled` から開始 | 孫 Fork を許可するかは新しい Owner が自分で判断すべき事項 |
| `visibility` | **`private` を既定**にする（Fork 直後は Owner が内容を確認・カスタマイズしてから公開できるようにする） | 意図せず未編集の複製がいきなり一般公開されるのを防ぐ |
| `forks` 行（帰属） | 新規1行 INSERT（`source_novel_id`, `forked_novel_id`, `forked_by`, `root_novel_id`） | §2.1 |

- Fork 実行はトランザクション内で「新 Novel 作成 → Chapter/Episode コピー → 初回 Revision 追記 → `collaborators`(owner) 作成 → `forks` 行 INSERT」を一括処理する（部分的に失敗した孤児 Novel を残さない）。
- slug は自動生成（元 slug + サフィックス）した上で `novels.slug` の UNIQUE 制約に従い衝突時は連番を付与。Owner は後から Studio でリネーム可能。

### 2.4 Fork Policy（Disabled / Approval Required / Allowed）

`novels.fork_policy`（enum `fork_policy`、[data-model.md](./data-model.md)）。**設定・変更は Owner のみ**（[auth.md](./auth.md) §3.1 補足、PRD §15）。

| Policy | Fork ボタンの表示 | `POST .../fork` の挙動 |
|---|---|---|
| `disabled`（既定） | 非表示（または disabled 状態で理由表示） | 403。Controller 到達前に Application Service が `ForkPolicyViolationError` を投げる |
| `approval_required` | 「Fork をリクエスト」ボタン | `forks` へ即書き込みせず、**`fork_requests`（本書提案、§2.6）に `pending` 行を作成**し、原作 Owner/Admin に通知。実際の Fork（新 Novel 作成）は承認後にのみ実行される |
| `allowed` | 「Fork する」ボタン | 即座に §2.3 のフローを実行し `forks` 行を作成 |

**判定の適用点**（Application Service 内で判定、Controller やビューには持たせない）:

```ts
// domain/fork/services/fork-policy.ts（スケッチ）
export type ForkPolicy = "disabled" | "approval_required" | "allowed";

export function evaluateForkRequest(policy: ForkPolicy): "reject" | "require_approval" | "proceed" {
  switch (policy) {
    case "disabled": return "reject";
    case "approval_required": return "require_approval";
    case "allowed": return "proceed";
  }
}
```

- 適用箇所は1つの `ForkNovelService`（または `RequestForkService`）のみに集約する。Controller・View・Repository には Fork Policy の分岐を持ち込まない（CLAUDE.md「認可はサーバ側で必ず実施」）。
- Public でない Novel（Unlisted/Private）は `fork_policy` の値に関わらず Fork 不可（Fork は「公開されている作品への派生」が前提。§3.2の 認可具体例参照）。

### 2.5 原作帰属表示の削除不可の強制

CLAUDE.md「Forked works cannot remove attribution to the original」と PRD §15「Forkされた作品では原作品への帰属表示を削除できない」を、**DB 制約**と**サーバ側検証**の二層で担保する。

**① DB 制約 — `forks` テーブルを物理的に不変にする**

- `forks.source_novel_id` は `ON DELETE RESTRICT`（[data-model.md](./data-model.md)）— 原作 Novel はそもそも物理削除できない（Soft Delete のみ）ため、帰属先の消滅による「表示できなくなる」事態を防ぐ。
- `forks` テーブル自体に **BEFORE UPDATE/DELETE トリガ**を追加し、アプリ層のバグや誤操作、あるいは Repository 実装ミスがあっても DB レベルで確実に拒否する。

```sql
CREATE OR REPLACE FUNCTION forbid_forks_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'forks is append-only: UPDATE/DELETE is not permitted (row id=%)',
    COALESCE(OLD.id, NEW.id);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER forks_immutable
  BEFORE UPDATE OR DELETE ON forks
  FOR EACH ROW EXECUTE FUNCTION forbid_forks_mutation();
```

- **決定 / 理由 / 代替案**: `ON DELETE RESTRICT` だけでは「`forks` 行自体を UPDATE/DELETE する」経路を塞げない（`source_novel_id` を書き換える、あるいは行そのものを消す、といった操作は FK 制約の対象外）。トリガで**行自体の変更・削除**を明示的に禁止することで「アプリ層に Repository の `update()`/`delete()` メソッドを実装し忘れる／将来別の開発者が追加してしまう」ことに対しても DB が最終防波堤になる（CLAUDE.md「原作側の帰属削除不可」を UI 実装依存にしない）。代替案（アプリ側 Repository に `update`/`delete` を単に実装しないだけ）は、直接 SQL を書く運用ミスや将来の管理画面実装で破られうるため不採用（DB 制約の方が確実）。

**② サーバ側検証 — 帰属表示を「消せる余地のあるデータ」として持たない**

- 帰属バナー（「Forked from: 〜」）は `novels` テーブルに**保存しない**。表示の都度 `forks.source_novel_id` を辿って動的生成する（[data-model.md](./data-model.md) 既定方針）。つまり「削除できる帰属テキスト」というフィールドがそもそも存在しない。
- Novel 設定更新 API（`PATCH /api/studio/novels/{novelId}` → `UpdateNovelMetadataService`）のリクエスト DTO は **allow-list 方式**で更新可能フィールドを明示列挙する（`title`/`catchphrase`/`description`/`genre`/`visibility`/`publication_status`/`content_warnings`）。帰属表示の抑制に使えるようなフィールド（例: `hideForkBanner` 的なフラグ）は allow-list に存在しないため、Application Service 側でリクエストボディに余分なキーがあっても無視される（型レベルで受け付けない。Zod/Valibot 等の Parse-don't-validate スキーマで未定義キーは黙って弾く）。
- `NovelDetailView`（SSR）は、Novel が fork 由来かどうかを**毎リクエスト** `ForkRepository.findBySourceNovelId` / `findByForkedNovelId` に問い合わせて決定し、View テンプレート側に「表示しない」分岐を作らない（フラグで on/off できる作りにしない）。これにより Controller/View レベルでの実装ミスによる非表示化も構造的に起こりにくくする。
- **決定 / 理由 / 代替案**: 帰属を「Novel の可変フィールド」として持たせない設計を採用。代替案（`novels.forked_from_label` のようなテキスト列を持たせ、削除を業務ロジックで禁止する）は、禁止ロジックのバグや将来の一括更新スクリプトで書き換えられるリスクが残るため不採用。データとして「削除可能な形」で存在させないことが最も堅牢。

---

### 2.6 Fork Policy = Approval Required の詳細（`fork_requests`、本書提案）

`forks` は append-only の確定記録専用（§2.5）であるため、「承認待ち」という中間状態を `forks` に混ぜ込まない。`collaboration_invitations` と対称的な新テーブルを提案する。

> **注記**: `fork_requests` は本書で新規提案するテーブルであり、現時点の [data-model.md](./data-model.md) には未記載。data-model.md 更新時に転記すること（[auth.md](./auth.md) が `password_reset_tokens` について行ったのと同じ扱い）。

#### `fork_requests`（提案）

| カラム | 型 | 制約 | index | 備考 |
|---|---|---|---|---|
| id | uuid | PK | | |
| source_novel_id | uuid | NOT NULL, FK→novels, ON DELETE CASCADE | idx | Fork 元。原作 Owner/Admin の承認キュー |
| requester_id | uuid | NOT NULL, FK→users, ON DELETE CASCADE | idx | Fork をリクエストしたユーザー |
| message | text | NULL | | リクエスト理由・意図（任意） |
| status | fork_request_status | NOT NULL default `pending` | idx | `pending`/`approved`/`rejected`/`canceled`（新規 enum、提案） |
| decided_by | uuid | NULL, FK→users, ON DELETE SET NULL | | 承認/却下した Owner/Admin |
| decided_at | timestamptz | NULL | | |
| forked_novel_id | uuid | NULL, FK→novels, ON DELETE SET NULL | idx | 承認時に実際に作成された Novel（承認して初めて確定） |

- **一意**: `UNIQUE(source_novel_id, requester_id) WHERE status='pending'`（同一ユーザーの二重リクエスト防止、`collaboration_invitations` と同じパターン）。

#### 状態遷移

```text
                     ┌────────────┐
    Fork リクエスト ──▶│  pending   │
                     └─────┬──────┘
                           │
       ┌───────────────────┼───────────────────┐
       │ Owner/Admin が承認  │ Owner/Admin が却下  │ requester が取り下げ
       ▼                   ▼                   ▼
 ┌───────────┐       ┌───────────┐       ┌───────────┐
 │ approved  │       │ rejected  │       │ canceled  │
 └─────┬─────┘       └───────────┘       └───────────┘
       │
       ▼
  §2.3 の Fork 実行フローをそのまま実行
  （新 Novel 作成 → forks 行 INSERT → forked_novel_id を本行に記録）
```

- 承認（`approved`）は**Fork の実行トリガ**であり、承認処理と Fork 実行（新 Novel 作成・`forks` INSERT）を同一トランザクションにする。
- 却下・取り下げでは新 Novel も `forks` 行も一切作られない。
- Application Service: `RequestForkService`（pending 作成）/ `ApproveForkRequestService`（承認 + Fork 実行）/ `RejectForkRequestService` / `CancelForkRequestService`。
- ルート（新規提案、[routing.md](./routing.md) への追記が必要）:

```
POST   /@{handle}/{slug}/fork-requests            … リクエスト作成（ログインユーザー）
GET    /studio/novels/{novelId}/fork-requests      … 承認待ち一覧（Owner/Admin）
POST   /api/fork-requests/{forkRequestId}/approve  … 承認（Owner/Admin）
POST   /api/fork-requests/{forkRequestId}/reject   … 却下（Owner/Admin）
POST   /api/fork-requests/{forkRequestId}/cancel   … 取り下げ（requester 本人）
```

---

## 3. Change Proposal（PR型、PRD §16）

> PRD §16 は「1.0への導入を目標とするが、Fork本体より優先度は低い」と明記する。本書は優先度に関わらず実装可能な粒度で設計だけを示す。

### 3.1 データモデルと base/head

`change_proposals` / `change_proposal_comments`（[data-model.md](./data-model.md)）が正典。

| 列 | 役割 |
|---|---|
| `target_novel_id` | 提案の宛先 Novel（原作、または共同制作中の Novel 本体） |
| `source_novel_id` | Fork 由来提案の場合のみ非 NULL（提案者の Fork 先 Novel）。共同制作内提案は NULL |
| `episode_id` | 対象 Episode（Change Proposal は Episode 単位、PRD §16 の例「Episode 3」） |
| `base_revision_id` | 分岐元 Revision（`episode_revisions` を参照）。diff の基準点 |
| `head_body` | 提案する本文の全文スナップショット |
| `proposer_id` | 提案者 |
| `status` | `open`/`accepted`/`rejected`/`withdrawn` |

**base/head の考え方**（GitHub PR の base/head に相当）:

```
base  = base_revision_id が指す episode_revisions.body（提案作成時点の target Episode の内容）
head  = head_body（提案者が書き換えた内容の全文）
diff  = base と head を行単位で比較（§3.4）
```

### 3.2 提案元の2パターン

```text
[パターン A] Fork 由来（source_novel_id あり）
  Fork先 Novel (Bob所有) で Episode を編集
       │
       ▼
  「原作へ変更を提案」
       │
  change_proposals {
    target_novel_id = 原作 Novel の ID
    source_novel_id = Bob の Fork Novel の ID
    episode_id      = 原作側の対応 Episode
    base_revision_id= 提案作成時点の原作 Episode の最新 Revision
    head_body       = Bob の Fork 側 Episode の本文
    proposer_id     = Bob
  }

[パターン B] 共同制作内（source_novel_id = NULL）
  同一 Novel の Viewer（編集権限なし）が
  「この段落をこう直したい」と直接編集はできないが提案は出したい
       │
       ▼
  change_proposals {
    target_novel_id = その Novel 自身の ID
    source_novel_id = NULL
    episode_id       = 対象 Episode
    base_revision_id = 提案作成時点の最新 Revision
    head_body        = 提案者が入力した修正後全文
    proposer_id      = Viewer 本人
  }
```

**決定 / 理由 / 代替案**

| | 内容 |
|---|---|
| **決定** | 提案作成の権限は、パターンA（Fork由来）は「target Novel を Fork した Novel の Owner/Admin/Writer/Editor」、パターンB（共同制作内）は「target Novel の Collaborator 全 Role（**Viewer を含む**）」とする。 |
| **理由** | Fork 由来の提案は原作にとって「外部からの寄稿」であり、Fork 側で実際に文章を書ける立場（Owner〜Editor 相当）に限定する妥当性が高い。一方、共同制作内提案は PRD §5 "Collaboration Is Native" の趣旨に沿い、**編集権限を持たない Viewer（ベータリーダー・監修者的な立場）が直接書き換えずに変更を提案できる唯一の手段**として意味を持つ。Viewer に提案権すら与えないと、Change Proposal 機能の共同制作内での価値がほぼ失われる。 |
| **代替案** | 共同制作内提案も Writer 以上に限定する案 — PRD の役割定義（Viewer=閲覧のみ）に厳密には近いが、「提案」自体は Episode を書き換えない読み取り専用相当の操作であり、Viewer に許可しても既存コンテンツを破壊するリスクがないため、より緩い方を採用。将来 PRD 側でこの解釈が否定された場合は Writer 以上に締める（未決事項）。 |

### 3.3 状態遷移

```text
                    ┌────────┐
     提案作成 ─────▶│  open  │
                    └───┬────┘
                        │
     ┌───────────────────┼───────────────────┐
     │ Owner/Admin が Accept │ Owner/Admin が Reject │ 提案者が取り下げ
     ▼                     ▼                     ▼
┌───────────┐        ┌───────────┐        ┌───────────┐
│ accepted  │        │ rejected  │        │ withdrawn │
└───────────┘        └───────────┘        └───────────┘

Comment はどの状態でも追加可能（open中の議論が主用途だが、
accepted/rejected 後の経緯コメントも許容し履歴として残す）。
```

- Accept/Reject の権限: **`target_novel_id` に対する Owner/Admin**（[auth.md](./auth.md) §3.1 の `proposal.decide` アクション、PRD §16「Ownerまたは権限を持つCollaboratorが」）。
- Withdraw: **提案者本人のみ**（`proposer_id` 一致）。Accept/Reject 後は withdraw 不可（既に確定した状態のため）。
- Comment 権限: 提案者本人 + `target_novel_id` の Collaborator（Viewer 以上）。Fork 由来提案の場合は加えて `source_novel_id` の Collaborator も閲覧・コメント可（自分たちが送った提案の行方を追えるようにする、未決事項として一般公開コメントの可否は§5参照）。

### 3.4 Diff 計算

- [writing-revision.md](./writing-revision.md) §2.4 の `RevisionDiffService`（行単位 LCS ベース diff）を Change Proposal でもそのまま再利用する。
- 入力は「`base_revision_id` が指す Revision の `body`」と「`head_body`」の2つの文字列（Revision 同士の diff と同じインタフェース）。
- 表示例（PRD §16 準拠）:
  ```text
  Alice proposed changes

  Episode 3
  + 3 paragraphs
  - 1 paragraph
  ```
- 差分計算は表示のたびに都度実行する（保存しない）。`base_revision_id` が指す Revision は append-only で不変なため、何度計算しても結果は安定する。

### 3.5 Accept 時の Revision 生成 — 「誰の版か」の確定

Accept は「Change Proposal の内容を target Episode に取り込み、新しい Revision を1件追記する」操作として [writing-revision.md](./writing-revision.md) の Revision 体系に統合する。

**本書での決定（writing-revision.md §5 未決事項5 を確定する）**:

- `episode_revisions` に **`source_proposal_id`（新規列、本書提案）** を追加する。`restored_from_id` と対称のカラムで、「この Revision がどの Change Proposal の取り込みで生まれたか」を記録する。

| カラム（追加提案） | 型 | 制約 | 備考 |
|---|---|---|---|
| `source_proposal_id` | uuid | NULL, FK→change_proposals, ON DELETE SET NULL | Accept で生成された Revision のみ非 NULL |

> **注記**: `data-model.md` の `episode_revisions` 定義に本列を追記すること。既存の `restored_from_id` と併存し、両方 NULL（通常保存）/ `restored_from_id` のみ非NULL（Restore由来）/ `source_proposal_id` のみ非NULL（Proposal Accept由来）のいずれかになる（同時に両方非NULLにはならない、CHECK制約候補として `restored_from_id IS NULL OR source_proposal_id IS NULL` を追加する余地あり）。

- **`editor_id` は提案者（`change_proposals.proposer_id`）を設定する。** 理由: Revision History は「誰が書いたか」の記録であり、実際に文章を書いたのは提案者であって Accept ボタンを押した Owner/Admin ではない（GitHub の "Co-authored-by" に近い発想。ただし ReNovel は単一 `editor_id` 列のため、取り込み実行者は `source_proposal_id → change_proposals.decided_by` を辿れば分かる形にする）。
- **Accept 処理手順**:
  1. Role 検証: `decided_by` が `target_novel_id` の Owner/Admin か（`CollaboratorPolicy.can(role, "proposal.decide")`、[auth.md](./auth.md) §4.1）。
  2. `base_revision_id` と target Episode の現在の最新 Revision を比較。**一致しない場合（他の変更が割り込んで進んでいる場合）は警告を提示**するが、1.0 では強制ブロックはせず「competing change あり」の確認フラグ付きで Accept を続行可能にする（真の3-wayマージは行わない、未決事項）。
  3. 新しい `episode_revisions` を追記: `body = head_body`、`editor_id = proposer_id`、`source_proposal_id = change_proposals.id`、`change_note = "Change Proposal #{id} accepted by {decided_by}"`。
  4. `episodes.body` / `char_count` / `updated_at` を新 Revision の内容で更新。
  5. `change_proposals.status = 'accepted'`、`decided_by`、`decided_at` を更新。
  6. 提案者へ通知（`notification_type='change_proposal'`）。

```ts
// application/services/accept-proposal-service.ts（スケッチ）
export class AcceptProposalService {
  async execute(input: { actorUserId: string; proposalId: string }) {
    return this.db.transaction(async (tx) => {
      const proposal = await this.proposals.findById(tx, input.proposalId);
      if (!proposal || proposal.status !== "open") throw new NotFoundError();

      const role = await this.collaborators.findRole(tx, proposal.targetNovelId, input.actorUserId);
      if (!CollaboratorPolicy.can(role, "proposal.decide")) throw new ForbiddenError();

      const revision = await this.revisions.append(tx, {
        episodeId: proposal.episodeId,
        editorId: proposal.proposerId,       // 提案者名義
        body: proposal.headBody,
        sourceProposalId: proposal.id,        // 出自の記録
        changeNote: `Change Proposal accepted by ${input.actorUserId}`,
      });
      await this.episodes.applyRevision(tx, proposal.episodeId, revision);
      await this.proposals.markAccepted(tx, proposal.id, input.actorUserId);
      await this.notifications.notifyProposalAccepted(tx, proposal);
    });
  }
}
```

### 3.6 Comment

- `change_proposal_comments`（[data-model.md](./data-model.md)）に平坦なコメント列として追記（返信ネストなし。`comments` テーブルの1段返信とは異なり、PR的な議論はスレッド不要のタイムライン表示で十分と判断）。
- Soft Delete は持たない（`change_proposals` 自体が append-only 志向のドメインであり、コメント削除が必要になった場合はモデレーション観点で `moderation.md` 側の Hide 機構を再利用する方針、未決事項）。

---

## 4. 認可の具体例（フロー図）

### ケース1: Owner が Admin を招待 → 承諾 → 参加

```
Owner(Alice) --招待(role=admin)--> collaboration_invitations(pending)
Bob --GET /me/invitations--> 一覧に表示
Bob --POST /api/invitations/{id}/accept-->
   状態: pending → accepted
   collaborators に (novel, Bob, admin) 追加
結果: Bob は次リクエストから Studio で Admin 操作（設定変更・Publish等）が可能
```
根拠: [auth.md](./auth.md) §3.1 マトリクス「Collaborator招待・削除・Role変更」= Owner/Admin。招待自体は Owner が実行し、承諾操作は Bob 本人のみ実行可能（§1.3）。

### ケース2: Fork Policy = Approval Required の Novel を第三者が Fork したい

```
Carol（原作 Collaborator ではない一般ユーザー）
  --POST /@alice/kamiwa-yuusha/fork-requests-->
     fork_requests(pending) 作成、原作 Owner/Admin へ通知
Alice(Owner) --GET /studio/novels/{id}/fork-requests--> 一覧確認
Alice --POST /api/fork-requests/{id}/approve-->
     fork_requests.status = approved
     → Fork実行フロー（§2.3）が同一トランザクションで走る
     → forks 行 INSERT、新 Novel 作成、Carol が Owner
```
根拠: `fork_policy='approval_required'` のため `forks` への直接書き込みは行わず `fork_requests` を経由（§2.4, §2.6）。承認は原作側 Owner/Admin のみ（Fork Policy 設定自体は Owner のみだが、個別リクエストの承認は Admin にも許可する設計 — Owner不在時の運用継続性を優先。**未決事項**として、承認を Owner限定にすべきかは残す）。

### ケース3: Forked Novel の Owner が原作へ Change Proposal を送り、原作 Owner が Accept

```
Bob（Carol の Fork Novel の Owner） が Episode 3 を編集
  --POST /api/novels/{原作novelId}/proposals-->
     change_proposals {
       target_novel_id=原作, source_novel_id=Bobのfork, proposer_id=Bob,
       base_revision_id=原作Episode3の現Revision, head_body=Bobの編集後本文
     } (status=open)
Alice(原作Owner) --GET /@alice/.../proposals/{id}--> diff確認、コメントで議論
Alice --POST /api/proposals/{id}/accept-->
     新 episode_revisions { editor_id=Bob, source_proposal_id=proposal.id } 追記
     原作 Episode 3 の本文が更新される
```
根拠: Accept権限は target Novel(原作)の Owner/Admin（§3.3, [auth.md](./auth.md) `proposal.decide`）。Revision の帰属は Bob（提案者、§3.5）。

### ケース4: Viewer が帰属表示バナーを消そうとする（拒否されるケース）

```
Bob（Forkされた Novel の Owner。しかし帰属表示を消したい）
  --PATCH /api/studio/novels/{forkedNovelId}--> { title: "...", hideForkBanner: true } のようなリクエスト
     → Application Service の DTO は allow-list 方式でパースし、
       hideForkBanner のような未定義キーはそもそも型として存在しないため無視/バリデーションエラー
     → forks 行は BEFORE UPDATE/DELETE トリガにより直接操作しようとしても DB レベルで例外
結果: 403/バリデーションエラーとなり、帰属表示は消えない
```
根拠: §2.5 の DB制約（トリガ）+ サーバ側検証（allow-list DTO）の二重防御。Owner 権限であっても帰属削除だけは業務ルール上不可能（Role マトリクスの「Novel設定変更」に帰属削除は含まれない=そもそも操作として存在しない）。

### ケース5: Owner 移譲中に旧Owner・新Ownerの権限が一時的にどうなるか

```
Alice(owner) --POST /api/studio/novels/{id}/transfer-owner { newOwnerUserId: Bob }-->
  トランザクション内:
    ① collaborators(Alice) role: owner → admin   （先に降格。部分unique index違反回避）
    ② collaborators(Bob)   role: writer → owner  （昇格）
    ③ novels.author_id = Bob
  コミット
結果: トランザクション外から見れば「Alice=admin, Bob=owner」に瞬時に切り替わる
     （中間状態がクエリから見えることはない、Postgres の read committed 分離レベルでも
       同一トランザクション内の逐次UPDATEは他トランザクションからコミット前に見えない）
```
根拠: §1.5。部分UNIQUE index制約とトランザクション分離レベルの両方を踏まえた順序設計。

---

## 5. data-model.md への追加提案（本書からの差分まとめ）

本書の設計を確定させるにあたり、[data-model.md](./data-model.md) に以下の追記が必要（本書はこれらを前提として記述している）。

| 追加対象 | 内容 |
|---|---|
| 新規テーブル `fork_requests` | §2.6 参照。Fork Policy = Approval Required の承認待ちを表現 |
| 新規 enum `fork_request_status` | `pending`/`approved`/`rejected`/`canceled` |
| `episode_revisions` への新規列 `source_proposal_id` | §3.5 参照。Change Proposal Accept 由来の Revision を追跡。`restored_from_id` と排他（CHECK制約候補） |
| `notifications.notification_type` への追加候補 | 既存の `collaboration_invite`/`fork`/`change_proposal` に加え、Fork リクエスト承認/却下・Owner 移譲を通知するなら細分化を検討（現状は `fork`/`change_proposal` に相乗りさせても機能はする、粒度は未決事項） |

---

## 6. 未決事項

1. **招待の有効期限（expired）日数**: 本書は「既定14日」を仮置きしたが、運用データがない段階での確定値は未決。
2. **Fork リクエスト（`fork_requests`）承認権限の範囲**: Owner のみに限定するか Admin にも許可するか（ケース2）。Fork Policy の設定自体は Owner 限定（PRD §15）だが、個別承認は運用継続性の観点で Admin にも開放する案を仮採用。要確定。
3. **Change Proposal Accept 時の競合（3-wayマージ）**: `base_revision_id` からの乖離を検知するのみで、自動マージや強制ブロックは行わない設計（§3.5 手順2）。実運用でコンフリクトが頻発する場合、[writing-revision.md](./writing-revision.md) の編集競合解決策（悲観ロック等）との統合を再検討。
4. **Change Proposal のコメント公開範囲**: Fork 由来提案の `source_novel_id` 側 Collaborator にもコメントを許可すると記載したが（§3.3）、原作の非公開議論が Fork 側に漏れる懸念とのバランスは未検証。
5. **Change Proposal コメントの削除・モデレーション**: `change_proposal_comments` に Soft Delete を持たせるかは [moderation.md](./moderation.md) 側との整合待ち。
6. **共同制作内 Change Proposal を Viewer に開放する設計（§3.2）の是非**: PRD の Role 定義（Viewer=閲覧のみ）とは厳密には緊張関係にある拡張解釈のため、プロダクト判断としての最終確認が必要。
7. **Fork のコピー範囲の詳細**: 表紙相当の情報を持たない ReNovel では影響が小さいが、将来 Novel にメディア添付が増えた場合のコピー方針（ストレージ上のファイル複製 or 参照共有）は [infrastructure.md](./infrastructure.md) 側との調整が必要。
8. **多段 Fork の表示 UI**（系譜の折りたたみ表示、孫 Fork 一覧への導線）は [frontend.md](./frontend.md) 側で別途検討。
9. **`fork_requests`/`episode_revisions.source_proposal_id` の data-model.md への正式転記時期**: 本書は先行提案として記述しているため、実装着手前に data-model.md 側の更新レビューを挟むこと。

---

## 関連ドキュメント

- [data-model.md](./data-model.md) — `collaborators`/`collaboration_invitations`/`forks`/`change_proposals`/`change_proposal_comments` のスキーマ正典、本書提案分の転記先
- [auth.md](./auth.md) §3.1, §4.1 — Collaborator Role 権限マトリクス、Policy オブジェクトの実装配置
- [writing-revision.md](./writing-revision.md) — Episode ライフサイクル・Revision 保存方式・Diff アルゴリズムの正典
- [routing.md](./routing.md) §3.3 — Collaboration/Fork/Change Proposal の既存ルート一覧、本書提案ルートの追記先
- [architecture.md](./architecture.md) §4 — `collaboration`/`fork` ドメインの責務境界
- [social-notification.md](./social-notification.md) — 招待・Fork・Change Proposal 通知の配信詳細
- [moderation.md](./moderation.md) — コメント・提案のモデレーション方針
