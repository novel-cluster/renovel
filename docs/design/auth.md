# Auth Design / 認証・認可設計

> 対象: Authentication（誰であるか）と Authorization（何ができるか）。CLAUDE.md が最重要視する「サーバ側での認可強制」の正典。
> 正典は PRD §6, §8, §9, §13, §52, §59。テーブル定義の正典は [data-model.md](./data-model.md)（`users` / `sessions` / `oauth_accounts` / `collaborators` / `novels` / `episodes`）— 本書は列名・enum 値を変更せずそのまま参照する。
> 現状は scaffold（Phase 0 完了）。本書は「これから作る目標形」を示す。

## サマリー

- **認証は Session（Cookie）を基本とし、パスワード認証と OAuth の両方をサポートする。** `users.password_hash` は Argon2id、OAuth は `oauth_accounts` に外部 ID を保持する多対一構成（[data-model.md](./data-model.md) §identity）。Provider の具体名（Google/GitHub 等）は未決事項に送る。
- **認証結果は Hono middleware が解決し `c.get("user")` / `c.get("session")` にのみ載せる契約とする。** Domain 層は Hono `Context` を一切知らず、Application Service が Context から取り出した最小限の値（`userId`, `role` など）だけを引数として渡す（PRD §52, CLAUDE.md）。
- **認可の中核は 2 軸のマトリクス**: (a) Novel 単位の **Collaborator Role**（Owner/Admin/Writer/Editor/Viewer）× 操作、(b) **Visibility × Publication Status × 閲覧者種別** のアクセス判定。両方を Application Service 内の **Policy オブジェクト**で判定し、Controller や View に業務ロジックを漏らさない。
- **Private Novel・未公開 Episode は権限がない場合 404 を返し、存在を秘匿する。** ログイン必須の操作で未ログインの場合のみ 403 相当（実際はログイン誘導のリダイレクト/401）を返す。この使い分けを本書で確定する。
- **Cookie は `HttpOnly` + `Secure` + `SameSite=Lax`** を既定にし、状態変更リクエストは Origin/Referer 検証によるダブルサブミット不要の CSRF 対策を取る（詳細 §5）。
- **Rate Limiting はログイン・パスワードリセット・OAuth コールバックなど攻撃対象になりやすい経路に重点適用**し、初期はアプリ内 in-memory + Postgres、スケール時に Redis へ移行する（[infrastructure.md](./infrastructure.md) §3.2 と歩調を合わせる）。

---

## 1. 認証方式

### 1.1 決定 / 理由 / 代替案

| | 内容 |
|---|---|
| **決定** | **Session ベース認証（Cookie + `sessions` テーブル）を主軸**とし、ログイン手段として **パスワード認証** と **OAuth** の両方を提供する。 |
| **理由** | PRD §52 は「最低限 Session Authentication と OAuth を想定」と規定するのみで Provider・パスワード有無は未確定だが、[data-model.md](./data-model.md) の `users` は既に `email` / `password_hash`（両方 nullable）と `oauth_accounts` を定義済みで、パスワードなし（OAuth のみ）ユーザーとパスワードありユーザーの共存を前提にしたスキーマになっている。本書はこの既定スキーマを正典として踏襲し、ReNovel 初期リリースから「メール+パスワード」でも「OAuth」でも登録・ログインできるようにする。読者・作者どちらも登録の摩擦を下げる（PRD §4 Target Users は非技術者含む一般読者・作者）ことを優先し、OAuth 必須にしない。 |
| **代替案** | (a) OAuth のみ（パスワードなし）— 実装は単純だが、Provider アカウントを持たない/使いたくないユーザーを排除する。ReNovel は「誰でも書ける」を掲げる（PRD §5 Text First）ため不採用。(b) Magic Link（メールのみ、パスワードレス）— UX は良いが、メール配信基盤（PRD §54 では Email は将来項目）が前提になり 1.0 のスコープ外。将来 `password_hash` を NULL のまま追加ログイン手段として検討可（未決事項）。(c) JWT ステートレス認証 — 即時失効・多重ログイン管理・Revoke が難しく、CLAUDE.md/PRD §59 が求める「Session Security」との相性が悪いため不採用。 |

### 1.2 パスワード認証

- 保存: `users.password_hash`（Argon2id、`memoryCost`/`timeCost` は infra 実測で調整。**平文・可逆暗号化は禁止**）。
- 登録要件: 最低 8 文字、既知の漏洩パスワードリスト照合は将来強化（未決事項）。
- ログイン識別子: `users.email`（`citext`、部分 UNIQUE `WHERE deleted_at IS NULL AND email IS NOT NULL`）。`handle` ログインは提供しない（`handle` は公開 URL であり変更されうるため識別子として不安定）。
- パスワードリセット: `password_reset_tokens`（新規、本書スコープで追加）— ワンタイムトークンのハッシュを保存し、有効期限 30 分、使用後即失効。

| カラム | 型 | 制約 | 備考 |
|---|---|---|---|
| id | uuid | PK | |
| user_id | uuid | NOT NULL, FK→users, ON DELETE CASCADE | |
| token_hash | text | NOT NULL, UNIQUE | 生トークンは保存しない（sessions と同様の方式） |
| expires_at | timestamptz | NOT NULL | 発行から 30 分 |
| used_at | timestamptz | NULL | 使用済みマーク。再利用防止 |

> `password_reset_tokens` は [data-model.md](./data-model.md) の identity ドメインに属する追加テーブル。同書には未記載のため、data-model.md 更新時に転記すること（本書は認可・フローの正典、テーブル一覧の正典は data-model.md）。

### 1.3 OAuth 認証

- 保存: `oauth_accounts(user_id, provider, provider_account_id)`。`UNIQUE(provider, provider_account_id)` により同一外部アカウントの二重登録を防ぐ（[data-model.md](./data-model.md)）。
- フロー: Authorization Code Flow（+ PKCE）。`state` パラメータを署名付き cookie に保存し CSRF/リプレイを防止。
- アカウント統合: OAuth コールバックで `provider_account_id` が既存ユーザーに紐付いていればログイン。未紐付きだが `email` が一致する既存ユーザーがいる場合は**確認画面を挟んでから**アカウント統合（自動統合しない — メール詐称による乗っ取りを防ぐ）。どちらもなければ新規ユーザー作成（`password_hash` は NULL）。
- Provider 候補: Google, GitHub, X（Twitter）。読者層は非技術者中心（PRD §4.1）なので Google を最優先候補とするが、**最終決定は未決事項**（PRD §52「具体的Providerは別途決定する」）。

### 1.4 セッションのライフサイクル

`sessions` テーブル定義は [data-model.md](./data-model.md) を正典とする（`id`, `user_id`, `token_hash`, `expires_at`, `ip`, `user_agent`）。

| フェーズ | 処理 |
|---|---|
| **発行**（ログイン成功時） | ① 高エントロピーな乱数トークン（256bit 以上, `crypto.randomBytes`相当）を生成。② SHA-256 ハッシュを `sessions.token_hash` に保存、生トークンは保存しない。③ 生トークンを Cookie にセット。④ `expires_at` は既定 30 日（Remember Me 相当を既定とする。短命セッションが必要な場面は将来「このデバイスを記憶しない」オプションで調整、未決事項）。 |
| **検証**（毎リクエスト） | Cookie の生トークンを SHA-256 化し `sessions.token_hash` を検索。`expires_at > now()` かつ紐づく `users.deleted_at IS NULL` かつ `users.status <> 'banned'` を満たせば有効。**`suspended` は認証は通すが機能を制限**（§4.4）。 |
| **スライディング延長** | 有効なセッションで `expires_at` まで残り 7 日を切ったら `expires_at` を +30 日に更新（DB 書き込みは検証と同一トランザクションでなくてよい。頻度を抑えるため「残り 7 日以内」の時だけ更新）。 |
| **失効（ログアウト）** | 対象 `sessions` 行を **物理削除**（Soft Delete 対象外。§1.6 の Soft Delete 一覧に `sessions` は含まれない）。Cookie も `Max-Age=0` でクリア。 |
| **全デバイスログアウト** | `user_id` に紐づく `sessions` を一括削除。パスワード変更・不審ログイン検知時に自動実行。 |
| **失効掃除** | `expires_at < now()` の行を定期バッチ/起動時クエリで削除（[data-model.md](./data-model.md) の `idx(expires_at)` を使用）。 |
| **同時セッション数** | 上限は設けない（1.0）。将来「ログイン中デバイス一覧・個別失効」UI を提供する場合、`ip`/`user_agent` を利用（未決事項）。 |

### 1.5 Cookie 設計

| 属性 | 値 | 理由 |
|---|---|---|
| 名前 | `__Host-renovel_session`（本番）/ `renovel_session`（dev, HTTP のため `__Host-` prefix 不可） | `__Host-` prefix は `Secure` + `Path=/` + `Domain` 属性なしを強制し、サブドメイン越境攻撃を軽減 |
| `HttpOnly` | 常に true | JS からの読み取り不可、XSS 経由のトークン窃取を防止（PRD §59 XSS 対策） |
| `Secure` | 本番: true / dev(HTTP): false | Cloudflare Tunnel 経由の本番は常時 HTTPS（[infrastructure.md](./infrastructure.md)） |
| `SameSite` | `Lax` | OAuth コールバック（外部 → 自サイトへの top-level navigation, GET）は `Lax` でも Cookie が送られる。`Strict` はコールバック直後にセッション未確立になりログイン UX を壊すため不採用 |
| `Path` | `/` | |
| `Max-Age` | `sessions.expires_at` と同期 | |

state cookie（OAuth `state` 保持用）は別名の短命 Cookie（5〜10分、`SameSite=Lax`, `HttpOnly`）を使う。

### 1.6 ゲスト（未ログイン）の扱い

- 未ログインでも `c.get("session")` は常に呼び出し可能な形にする（値は `null`）。`c.get("user")` も同様に `null` を許容する型 (`User | null`) とし、Controller 側で `null` チェックを強制する（TypeScript `strict` により未チェックのプロパティアクセスをコンパイルエラーにする設計、後述 §3）。
- ゲストは Public Novel の閲覧、検索、ランキング閲覧は可能（PRD §9 Public は「誰でも閲覧可能」）。Like/Star/Review/Comment/Follow/Library/執筆系は**ログイン必須**であり、未ログインアクセス時はログイン画面へリダイレクト（HTML ページ）または `401 Unauthorized`（fetch/API 経路）を返す。

---

## 2. 認証コンテキスト — Middleware 契約

### 2.1 責務分担

```
Presentation/middleware/auth.ts
  1. Cookie からトークン抽出
  2. sessions を検証（有効期限・ユーザー状態）
  3. c.set("session", Session | null)
  4. c.set("user",    AuthUser | null)
      ↓
Presentation/controllers/*
  - c.get("user") / c.get("session") を読む
  - Application Service へ「必要な値だけ」渡す（例: userId, novelId）
      ↓
Application/services/*
  - Policy を使って認可判定（§4）
  - Domain Repository を呼ぶ
      ↓
Domain
  - Context を知らない。渡された値のみで完結
```

- **Domain 層は `c.get` は元より、`AuthUser` 型そのものにも依存しない。** Domain が必要とするのは `authorId: UserId` のような値であり、それを Application が Context から取り出して渡す（CLAUDE.md「Controllers stay thin」「Domain code must not import Hono Context」）。
- **`AuthUser`（Context に載る形）** は `users` テーブルの薄い射影のみを持つ:

```ts
// presentation/middleware/auth.ts のスケッチ
type AuthUser = {
  id: string;          // users.id (uuid)
  handle: string;
  displayName: string;
  status: "active" | "suspended" | "banned";
};

type AuthSession = {
  id: string;           // sessions.id
  expiresAt: Date;
};

// Hono Context の型拡張
type Env = {
  Variables: {
    user: AuthUser | null;
    session: AuthSession | null;
  };
};
```

- `banned` ユーザーは middleware の時点でセッションを無効化し `user`/`session` を `null` にする（§4.4）。`suspended` は `user` を載せた上で Application 側の Policy が機能制限を判定する（凍結中でも自分の設定画面は見られる、等の粒度差があるため）。

### 2.2 Application Service への受け渡し規約

- Controller は Service 呼び出し時に **DTO/プリミティブのみ**を渡す。`Context` オブジェクトそのものを Service へ渡さない。

```ts
// 良い例
await publishEpisodeService.execute({
  actorUserId: c.get("user")!.id,
  novelId: params.novelId,
  episodeId: params.episodeId,
});

// 悪い例（Context を Service に渡す = Domain 汚染の入口になる）
await publishEpisodeService.execute(c, params.novelId, params.episodeId);
```

- ログイン必須ルートは共通 middleware `requireAuth()` で `user === null` を弾き、Controller 本体では `user` の非 null をアサーションできるようにする（Hono middleware chain で型を絞り込むヘルパを `presentation/middleware/require-auth.ts` に用意）。

---

## 3. 認可モデル（中核）

認可判定は 2 系統に分かれる。(a) **Collaborator Role** による Novel 内操作の可否、(b) **Visibility × Publication Status × 閲覧者種別** による到達可否（そもそも見えるか）。実際のリクエストは (b) → (a) の順で評価する（見えないものは操作もできない）。

### 3.1 (a) Collaborator Role 権限マトリクス（PRD §13）

Role は `collaborators.role`（enum `collaborator_role`: `owner`/`admin`/`writer`/`editor`/`viewer`、[data-model.md](./data-model.md)）。**Novel あたり `owner` は 1 行のみ**（部分 UNIQUE index）で、`novels.author_id` と一致させる。

| 操作 | Owner | Admin | Writer | Editor | Viewer | 非Collaborator(ログイン) | ゲスト |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| Novel 削除 | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Novel 設定変更（Title/Genre/Visibility/Fork Policy 等） | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Collaborator 招待・削除・Role 変更 | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Episode 作成 | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Episode 編集（Draft 中） | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Episode Draft 保存 | ✅ | ✅ | ✅ | ❌* | ❌ | ❌ | ❌ |
| Revision 作成（保存の都度自動記録） | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Revision 復元 | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Publish / Scheduled Publish | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Chapter 作成・並べ替え | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Change Proposal の Accept/Reject（PRD §16） | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Private Novel / Draft Episode の閲覧 | ✅ | ✅ | ✅ | ✅ | ✅ | ❌(§3.2で404) | ❌(404) |
| 公開後 Episode の閲覧 | ✅ | ✅ | ✅ | ✅ | ✅ | Visibility 次第 | Visibility 次第 |

\* PRD §13 は Writer の権限として「Draft保存」を明記し Editor には明記していない。**決定**: Editor は「Episode編集・Revision作成」に限定し、新規 Draft の作成・保存は Writer 以上に限定する（Editor は既存原稿の校正役という PRD の役割区分を反映）。Editor が既存 Draft の内容を編集して保存する行為自体は「Episode編集」に含まれるため可能。**代替案**: Editor にも Draft 保存を許可する運用も検討可能（PRD の記述が薄いため） — 実運用で違和感があれば緩和する。未決事項に記載。

補足:
- Owner は Admin の全操作に加え Novel 削除・Owner 委譲ができる（Owner 委譲は「新 Owner を任命 → 旧 Owner は Admin に降格」の 2 段操作とし、Novel が Owner 不在になる瞬間を作らない）。
- **Fork Policy の設定・変更は Owner のみ**（PRD §15「Ownerは以下から設定する」）。Admin には許可しない（Admin マトリクスは PRD 上「Novel設定変更」を含むが、Fork Policy は帰属・法的性質が強いため明示的に Owner 限定と決定する）。

### 3.2 (b) Visibility × Publication Status × 閲覧者 アクセス判定表（PRD §8, §9）

Visibility（`public`/`unlisted`/`private`）と Publication Status（`ongoing`/`completed`/`hiatus`）は**直交**（PRD §8）。Publication Status は「見えるか」ではなく「執筆中/完結/休止」という表示上のバッジに過ぎず、**アクセス可否には影響しない**（Hiatus でも Public なら誰でも読める）。アクセス可否を決めるのは Visibility と Content State（モデレーション Hide）、および閲覧者種別。

| Visibility | ゲスト | ログイン済み(無関係) | Collaborator(Viewer以上) | 検索/ランキング/新着 |
|---|---|---|---|---|
| **Public** | 閲覧可 | 閲覧可 | 閲覧可 | 対象（PRD §9） |
| **Unlisted** | URL 直知なら閲覧可・一覧非表示 | URL 直知なら閲覧可・一覧非表示 | 閲覧可 | 非対象（PRD §9） |
| **Private** | **404**（存在秘匿） | **404**（Collaborator でなければ） | 閲覧可 | 非対象 |

- **Unlisted の実装**: 「URLを知っていれば閲覧可」は認可というより「一覧・検索・推薦のクエリに含めない」制御。Controller 側でアクセス自体は許可しつつ、Discovery 側の Query（[discovery.md](./discovery.md)）で `visibility = 'public'` のみを対象にする。
- **content_state = 'hidden'**（モデレーションによる Hide、PRD §37）は Visibility に関わらず**一般閲覧者には 404**。Owner/Collaborator と Moderator（管理者）には警告バナー付きで閲覧可能とする（未決事項: Moderator ロールの認可設計は [moderation.md](./moderation.md) に委譲）。

#### Episode 単位の判定（PRD §8, §12, `episodes.status`/`episodes.visibility`）

Episode は Novel の Visibility を継承しつつ（`episodes.visibility IS NULL` の場合）、`episode_status`（`draft`/`published`）で公開前後を分ける。

| episodes.status | episodes.visibility（実効値） | 閲覧可能な者 |
|---|---|---|
| `draft` | 問わず | Owner/Admin/Writer/Editor/Viewer（= Collaborator 全 Role）のみ。非 Collaborator は**404** |
| `published` | 実効 Visibility = `public` | Novel の Public 判定に従う（誰でも） |
| `published` | 実効 Visibility = `unlisted` | URL 直知で閲覧可、一覧非対象 |
| `published` | 実効 Visibility = `private` | Collaborator(Viewer 以上) のみ、他は 404 |

- 実効 Visibility の解決式: `effectiveVisibility(episode) = episode.visibility ?? novel.visibility`。ただし **Novel が `private` の場合、Episode 個別設定で `public` に緩めることはできない**（Novel の Private は Novel 全体の非公開を意味する = 上位制約が優先）。この優先順位を Policy 内で明示的に検証する（下位が上位より広い可視性を持てないよう `min(novelVisibility, episodeVisibility)` 相当のロジックにする）。

### 3.3 Draft/Unlisted/Private の編集判定

「閲覧できる」と「編集できる」は別軸。編集は常に §3.1 の Collaborator Role マトリクスに従う（Visibility に関わらず、Role がなければ編集不可）。まとめると評価順序は次の通り:

```
1. Novel/Episode が存在し、かつ Soft Delete/Hide されていないか
2. 閲覧要求か編集要求か
   - 閲覧要求 → §3.2 の Visibility 判定（Collaborator は常に閲覧可）
   - 編集要求 → Collaborator Role を取得できなければ即 403（存在は伏せない。編集 URL は
     ログイン薄いユーザーには通常到達しないため 404 に倒す必要性が低く、後述の 403/404 使い分け方針に従う）
```

---

## 4. 認可の実装配置

### 4.1 Policy オブジェクト（Domain）と Application Service の分担

- **判定ロジックの本体は Domain 層の Policy オブジェクト**に置く（例: `domain/collaboration/services/collaborator-policy.ts`, `domain/novel/services/visibility-policy.ts`）。Policy は純粋関数/クラスで、`Role` や `Visibility` など Value Object のみを引数に取り、Hono/Drizzle に依存しない。

```ts
// domain/collaboration/services/collaborator-policy.ts（スケッチ）
export type CollaboratorRole = "owner" | "admin" | "writer" | "editor" | "viewer";
export type CollaborationAction =
  | "novel.delete" | "novel.settings.update" | "novel.fork_policy.update"
  | "collaborator.manage" | "episode.create" | "episode.edit"
  | "episode.publish" | "revision.restore" | "proposal.decide" | "view.private";

const MATRIX: Record<CollaborationAction, CollaboratorRole[]> = {
  "novel.delete": ["owner"],
  "novel.fork_policy.update": ["owner"],
  "novel.settings.update": ["owner", "admin"],
  "collaborator.manage": ["owner", "admin"],
  "episode.create": ["owner", "admin", "writer"],
  "episode.edit": ["owner", "admin", "writer", "editor"],
  "episode.publish": ["owner", "admin"],
  "revision.restore": ["owner", "admin", "writer"],
  "proposal.decide": ["owner", "admin"],
  "view.private": ["owner", "admin", "writer", "editor", "viewer"],
};

export function can(role: CollaboratorRole | null, action: CollaborationAction): boolean {
  if (!role) return false;
  return MATRIX[action].includes(role);
}
```

- **呼び出しは Application Service から**: Service が Repository 経由で `role = await collaboratorRepository.findRole(novelId, userId)` を取得し、`CollaboratorPolicy.can(role, "episode.publish")` を評価してから Domain 操作を実行する。**Policy 自体は DB を読まない**（Repository が読む。Policy は判定式のみ）。
- **Visibility 判定も同様に Domain Policy 化**する（`NovelAccessPolicy.canView({ visibility, contentState, viewerRole })`）。Repository/Query 層が `visibility`/`content_state`/Role を集めて Policy に渡す。

### 4.2 Middleware の責務（狭い）

Middleware は次のみを担当し、**Role/Visibility の業務判定はしない**:

| Middleware | 責務 |
|---|---|
| `auth()` | Cookie→Session 検証、`c.set("user"/"session")`。全ルート共通 |
| `requireAuth()` | `user === null` なら 401/リダイレクト。ログイン必須ルートにのみ付与 |
| `csrf()` | 状態変更メソッドの Origin/Token 検証（§5） |
| `rateLimit(bucket)` | ログイン等センシティブ経路の試行回数制御（§6） |

Collaborator Role の解決・Visibility 判定は **Application Service（または Service が呼ぶ Query）** が行う。理由: これらは「この特定の Novel/Episode に対してこのユーザーは何者か」という**リクエストのビジネス的な意味**そのものであり、汎用 middleware に持たせるとルートごとの例外（例: Fork Policy だけ Owner 限定）が middleware 内の分岐地獄になる。Service 層に置くことで Use Case ごとに素直に読める。

### 4.3 403 と 404 の使い分け

| 状況 | ステータス | 理由 |
|---|---|---|
| 未ログインで、ログイン必須の操作（Like/投稿/設定変更など）を叩いた | `401`（API）/ ログイン画面へリダイレクト（HTML） | 「ログインすれば実行できる」ことを隠す必要がない |
| ログイン済みだが対象 Novel/Episode の Collaborator ではなく、**Private** である | `404` | **Private の存在自体を秘匿する**（PRD §9 の意図。「非公開作品がある」という事実の漏洩を防ぐ） |
| ログイン済みで Collaborator だが Role 不足（例: Viewer が Publish を叩く） | `403` | 対象の存在は分かっている（閲覧はできる）上での権限不足なので、素直に「権限がない」と伝えてよい |
| Public/Unlisted な Novel の **Draft Episode** に非 Collaborator がアクセス | `404` | Draft の存在を非公開扱いする（未公開話のネタバレ防止も兼ねる） |
| モデレーションで Hide された Novel/Episode に一般閲覧者がアクセス | `404` | Hide は「一般には無かったことにする」処置（PRD §37） |
| CSRF トークン不一致・Origin 不一致 | `403` | 攻撃遮断の意図を隠す必要はない |

**原則**: 「対象の存在を知られること自体がプライバシー/秘匿性の侵害になる場合は 404、対象の存在は知られてよいが権限が無いだけの場合は 403」。Private と Draft は前者、Role 不足は後者。

### 4.4 アカウント状態（`users.status`）とアクセス

| status | ログイン | 閲覧(読者として) | 投稿・編集・社会的操作 |
|---|---|---|---|
| `active` | 可 | 可 | 可 |
| `suspended` | 可（自分の状況確認のため） | 可 | **不可**（Application Service の共通ガードで一律拒否。理由は §37 Suspend の意図＝一時的な機能停止） |
| `banned` | **不可**（既存セッションも middleware で即時無効化） | ─ | ─ |

- 実装: `requireAuth()` を通過した後、状態変更系 Service の共通前処理（`AuthorizationGuard`）で `user.status === "active"` を要求するヘルパを用意し、各 Service で個別に status を見なくて済むようにする。

---

## 5. CSRF 対策

| | 内容 |
|---|---|
| **決定** | **Origin/Referer 検証 + SameSite=Lax Cookie** を基本戦略とし、状態変更を伴う全リクエスト（`POST`/`PUT`/`PATCH`/`DELETE`）で `Origin` ヘッダがアプリの許可オリジンと一致することを middleware で検証する。加えて、Editor Autosave など island からの `fetch` には `X-Requested-With: XMLHttpRequest` 相当のカスタムヘッダ必須化を併用し、単純フォーム送信（CSRF の主経路）を追加でブロックする。 |
| **理由** | Session Cookie 方式は CSRF の主対象になる（PRD §59 明記）。`SameSite=Lax` は GET のトップレベル遷移では Cookie を送るため単体では不十分（クロスサイト POST は `Lax` でもブロックされるが、防御は多層化が望ましい）。Synchronizer Token（隠しフィールドにトークン埋め込み）は SSR フォームには適用しやすいが、hono/jsx の island から叩く JSON API では配布・検証の手間が増える。Origin 検証は実装コストが低く、SSR/API 両方に一律適用できる。 |
| **代替案** | (a) 二重送信 Cookie（Double Submit Token）— 追加の Cookie とヘッダ照合が必要で実装コストが上がる。将来 Origin 検証だけでは不十分と判明した場合に追加する（未決事項）。(b) Synchronizer Token をフォーム毎に発行 — SSR ページ（Novel 設定変更等）には有効なので、**高リスク操作（Collaborator 削除、Novel 削除、パスワード変更）に限り追加のトークン確認を将来的に重ねる**余地を残す。 |

- **CSP（PRD §59）** も CSRF/XSS の縦深防御として設定する: `default-src 'self'`、インライン script は原則禁止（island のバンドルは外部ファイル化）、詳細は [architecture.md](./architecture.md) §9 に集約。

---

## 6. Rate Limiting / Brute-force 対策

一般方針は [architecture.md](./architecture.md) §9（横断的関心事）を参照。本書では認証特有のしきい値を定義する。

| 経路 | キー | 上限（目安） | 超過時の挙動 |
|---|---|---|---|
| ログイン（パスワード） | `email` + IP | 5 回 / 15 分 | 429 + 指数バックオフ提示。連続失敗でアカウント一時ロック通知（メール、将来） |
| パスワードリセット要求 | `email` | 3 回 / 時間 | 429。メール送信自体も抑制（メール爆撃防止） |
| OAuth コールバック | IP | 20 回 / 時間 | 429（正規フローでは稀な多発のため） |
| サインアップ | IP | 10 回 / 時間 | 429（bot 登録対策） |
| セッション検証自体 | — | 制限なし | 通常のページ閲覧を阻害しない |

- **実装配置**: `presentation/middleware/rate-limit.ts`。初期実装（1.0, Redis 未導入時点）はアプリプロセス内 in-memory カウンタ + Postgres フォールバック（`login_attempts` 等の簡易テーブル、複数インスタンス運用に入ったら不正確になる点は許容）。**スケール時に `redis` を Compose に追加**し、共有カウンタへ移行する（[infrastructure.md](./infrastructure.md) §3.2 の想定と一致）。
- Cloudflare 経由のためエッジ側 WAF/レート制御も併用（[infrastructure.md](./infrastructure.md) の Cloudflare Tunnel 節）。アプリ側の Rate Limiting はエッジをすり抜けた/内部由来のケースへの縦深防御。
- パスワード検証は**タイミング攻撃対策**として、ユーザーが存在しない場合もダミーハッシュに対して Argon2id 検証を実行し応答時間を均す。

---

## 7. Application Service 実装例（コマンド系）

Episode 公開（PRD §48 のフローに認可判定を組み込んだ具体例）:

```ts
// application/services/publish-episode-service.ts（スケッチ）
export class PublishEpisodeService {
  constructor(
    private episodes: EpisodeRepository,
    private collaborators: CollaboratorRepository,
  ) {}

  async execute(input: { actorUserId: string; novelId: string; episodeId: string }) {
    const role = await this.collaborators.findRole(input.novelId, input.actorUserId);
    if (!CollaboratorPolicy.can(role, "episode.publish")) {
      throw new ForbiddenError(); // Controller が 403 にマップ
    }
    const episode = await this.episodes.findById(input.episodeId);
    if (!episode || episode.novelId !== input.novelId) {
      throw new NotFoundError(); // Controller が 404 にマップ
    }
    episode.publish(); // Domain のドメインロジック（状態遷移の妥当性は Entity 側で検証）
    await this.episodes.save(episode);
  }
}
```

- `ForbiddenError`/`NotFoundError` は `shared/errors` に定義し、Controller 側の共通エラーハンドラで HTTP ステータスへマッピングする（§4.3 の表と対応させる）。Controller 自身が `if (role !== "owner") return c.text("", 403)` のような判定を書かない。

---

## 8. 未決事項

1. **OAuth Provider の最終決定**（PRD §52「別途決定」）。候補: Google（読者層優先）, GitHub（技術系作者に強い）, X。複数同時サポートか 1.0 は 1 provider に絞るかも未決。
2. **パスワード認証を 1.0 スコープに含めるか**: 本書は data-model.md のスキーマ（`password_hash` 列の存在）を根拠に「含める」前提で書いたが、プロダクト判断として OAuth のみへ絞る可能性は残る。絞る場合は `password_reset_tokens` 節・§1.2 を削除。
3. **Editor Role の Draft 保存可否**（§3.1 の脚注）。PRD 記述が薄く、実運用でのフィードバック待ち。
4. **Moderator/Admin（運営側）の認可モデル**: 本書は Collaborator Role のみを扱う。運営管理者アカウントの権限体系（`users` に `is_admin` を持たせるか別テーブルか）は [moderation.md](./moderation.md) 側で定義し、本書からリンクする。
5. **Content Warning 閲覧前確認の実装**: 認可（見えるか）ではなく UX 上の確認モーダルだが、未ログイン時に確認状態をどう永続化するか（Cookie か localStorage か）は [reading.md](./reading.md) 側で検討。
6. **二段階認証（2FA）**: PRD に明記なし。Collaborator 権限が強い Owner アカウント向けに将来追加候補（`users` に `totp_secret` 等）。1.0 スコープ外と仮置き。
7. **Double Submit Cookie の追加要否**（§5 代替案 (a)）: Origin 検証のみで十分か、実装後にセキュリティレビューで判断。
8. **同一ユーザーの複数 OAuth Provider 連携 UI**: `oauth_accounts` は複数行を許容するスキーマだが、アカウント設定画面での連携/解除フローは未設計。
9. **`suspended` 中に許可する操作の粒度**: 本書は「投稿・編集・社会的操作を一律不可」としたが、例えば「非公開化のみ許可」等の細分化が必要かは運用ポリシー次第。

---

## 関連ドキュメント

- [data-model.md](./data-model.md) — `users`/`sessions`/`oauth_accounts`/`collaborators`/`novels`/`episodes` のスキーマ正典
- [architecture.md](./architecture.md) §6, §9 — 認証・認可の全体配置、横断的関心事（CSP/Rate Limiting 一般方針）
- [collaboration-fork.md](./collaboration-fork.md) — Collaborator 招待フロー、Fork Policy の詳細
- [writing-revision.md](./writing-revision.md) — Draft/Publish/Scheduled Publish の状態遷移
- [moderation.md](./moderation.md) — Report/Hide/Suspend/Ban の運営フローと Moderator 権限
- [infrastructure.md](./infrastructure.md) — Redis 導入時期、Cloudflare 側のレート制御・TLS
