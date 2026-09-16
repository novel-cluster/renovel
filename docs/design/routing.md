# Routing / URL・API 設計

> 対象: 全ページの URL 設計、slug/handle のルール、ルート表（カテゴリ別）、SSR ページと island 用 JSON API・Analytics fire-and-forget エンドポイントの区分、canonical/noindex、REST 規約。
> 正典は PRD §7, §17, §23, §56。テーブル名・カラム名は [data-model.md](./data-model.md) を正典として厳密一致させる。レイヤ構成は [architecture.md](./architecture.md)、レンダリング方針は [frontend.md](./frontend.md) を参照。
> 現状は scaffold（Phase 0 完了）。本書は「これから作る目標形」を示す。

## サマリー

- **人間向け正規 URL は `/@{handle}/{novelSlug}`・Episode は `/@{handle}/{novelSlug}/episodes/{episodeNo}`**（PRD §7 の human-readable / reader-first 方針、SEO §56 を満たすため）。加えて `/novels/{slug}` を **handle 変更に強い永続パーマリンク**として用意し、常に正規 URL へ 302 する。
- **slug は Novel 作成時にシステムが短い ASCII ランダム値を自動生成**し、著者は任意で ASCII カスタム slug に変更できる（Nは日本語タイトルが大半のため slug をタイトルから自動生成しない）。`slug` は `novels` テーブル全体で一意（[data-model.md](./data-model.md) 準拠）。
- **著者の作業導線は `/studio/*` に集約**し、公開閲覧 URL（`/@{handle}/...`）とは名前空間を分離する。`/studio/*` 配下は ID ベース（`novelId`/`episodeId`）で操作し、認可失敗は 403。公開閲覧側で非公開コンテンツへアクセスした場合は **存在の秘匿のため 404** を返す（PRD §58,59）。
- **SSR ページ・island 用 JSON API・Analytics fire-and-forget API を URL 空間で明確に分離**する: SSR は素のパス、island 用 API は `/api/...`、分析送信は `/api/analytics/events` 一本化。
- **canonical/noindex は `visibility` 列で決定**（Public のみ index、Unlisted/Private は noindex）。パーマリンク（`/novels/{slug}` 系）は 302 リダイレクトそのものであり、index 対象にしない。
- **REST 規約**: リソース名は複数形、ネストは最大2階層、ミューテーション系 API は ID ベース、閲覧 SSR ページは slug/handle ベース。Controller はドメインの集約単位（Novel/Episode/Collaborator 等）で分割し、ネストしたサブリソースを一つの巨大 Controller に詰め込まない。

---

## 1. URL 設計の原則

1. **Reader First / 人間可読**（PRD §5, §56）: URL はできる限り人間が読んで意味が分かる形にする。内部 ID（UUID）を公開 URL の主キーにしない。
2. **SEO を主目的の一つとする**（PRD §56）: Public な Novel/Episode は検索エンジンに拾われやすい安定 URL を持つ。パス変更が起きても意味のある恒久リンク（パーマリンク）を用意する。
3. **著者アイデンティティを URL に織り込む**: 作品 URL は `/@{handle}/...` 配下に置き、読者が「誰の作品か」を URL から把握できるようにする（PRD §6 の handle 設計と一貫）。
4. **公開閲覧と著者管理を URL 空間で分離する**: 同じ Novel でも「読む」導線と「書く/設定する」導線は別プレフィックスに置き、認可ロジックとキャッシュ戦略を単純化する。
5. **API は人間可読性より安定性を優先する**: island や外部連携から叩く JSON API は ID ベースにし、著者が slug やタイトルを変更しても island 側の実装が壊れないようにする。

---

## 2. slug / handle 設計

### 2.1 `users.handle`

- 決定: `/@{handle}` をユーザーの公開プロフィール URL とする（[data-model.md](./data-model.md) `users.handle`、`^[a-z0-9_]{3,30}$`、小文字保存）。
- 理由: PRD §6 のユーザーモデルに準拠し、SNS的に浸透した `@handle` 記法は認知コストが低い。
- 変更: handle は本人が変更可能（[auth.md](./auth.md) に詳細を委譲）。**handle 変更時、旧 handle 配下の URL（`/@{oldHandle}` および `/@{oldHandle}/{slug}` 系）は直ちに無効化し 404 とする**（旧 handle は解放され他ユーザーが取得しうるため、リダイレクトを残すと誤帰属を招く）。恒久リンクが必要な場面のためにパーマリンク（§2.4）を用意する。

### 2.2 `novels.slug`

| | 決定 |
|---|---|
| **決定** | Novel 作成時に **システムが ASCII の短いランダム slug を自動生成**（例: Base36, 8文字, `novels.slug` に格納）。著者は任意で ASCII カスタム slug（`^[a-z0-9-]{3,50}$`）へ変更可能。 |
| **理由** | ReNovel は日本語タイトルが大半で、タイトルから機械的に slug を生成すると意味不明なパーセントエンコードや不安定なローマ字化になり SEO 上も可読性上も逆効果。ランダム slug は衝突しにくく即時発行できる。カスタム化を許すことで、望む著者には意味のある URL（記憶しやすい・SNS で貼りやすい）を提供できる。 |
| **代替案** | (a) タイトルの機械的スラグ化（ローマ字変換 or pinyin 的処理）— 精度が低く不採用。(b) Novel の内部 ID（UUID）をそのまま URL に使う — 可読性ゼロで PRD §56 の SEO 方針に反し不採用。(c) `handle` スコープ内でのみ一意な slug（`(handle, slug)` 複合一意） — [data-model.md](./data-model.md) では `novels.slug` を**グローバル一意**と定義済みのため、本書はそれに合わせグローバル一意を採用（handle 変更時に URL 再計算が不要という副次的な利点もある）。 |

- **一意性・衝突回避**: DB の `UNIQUE(slug)` 制約（[data-model.md](./data-model.md)）で強制。カスタム slug 変更 API は事前に `SELECT EXISTS` で可用性チェックを行い、UI で即時フィードバック。衝突時は API が `409 Conflict` を返す。
- **禁止語**: `new`, `edit`, `episodes`, `settings`, `analytics`, `proposals`, `fork` 等ルーティング上の予約語は slug として使用不可（アプリ層バリデーションで拒否。`/@{handle}/{slug}/episodes/...` のパス衝突を避けるため）。
- **slug 変更時の 301**: `novels.slug` を変更すると旧 slug の `/@{handle}/{旧slug}` は無効になる。恒久リンク（§2.4 の `/novels/{slug}`）でのみ継続アクセス性を担保する方針とし、旧 slug から新 slug への自動 301 は**現状スコープ外**（§7 未決事項に記載。将来 `novel_slug_history` テーブル追加で対応可能）。

### 2.3 Episode URL — `episode_no` ベース

- 決定: Episode の公開 URL は `episodes.episode_no`（Novel 内通し番号、[data-model.md](./data-model.md)）を使う。`/@{handle}/{slug}/episodes/{episodeNo}`。
- 理由: `episode_no` は Chapter の有無に関わらず Novel 内で連番（PRD §7.1, データモデル `UNIQUE(novel_id, episode_no)`）のため、目次順そのままの安定した人間可読 URL になる。内部 `episodeId`（UUID）は Studio 側 API でのみ使用。
- Chapter は URL パス階層に反映しない（Chapter は任意構造でありパス階層化すると Chapter 追加/削除時に URL が壊れるため）。目次表示は Novel ページ内でツリー表示する。
- `episodes` という固定セグメントを挟むことで、Novel 直下の他サブリソース（後述の `/reviews` 等）とのパス衝突を避ける。

### 2.4 パーマリンク（`/novels/{slug}`）

- 決定: `/novels/{slug}` および `/novels/{slug}/episodes/{episodeNo}` を**恒久パーマリンク**として用意し、常に現在の正規 URL `/@{handle}/{slug}/...` へ **302 リダイレクト**する。
- 理由: `novels.slug` はグローバル一意で著者の handle 変更の影響を受けないため、共有・ブックマーク・QR コード・システム生成リンク（通知メール等）にはこちらを使うことで handle 変更後もリンク切れを起こさない。
- 302（恒久ではなく一時）を使う理由: 正規 URL 自体は将来変わりうる（handle 変更）ため、ブラウザ/クローラにキャッシュさせない。検索エンジンには canonical タグ（§5）で正規 URL を明示する。

---

## 3. ルート表

表記: **認証要否** = 未ログインで到達可能か。**認可** は [auth.md](./auth.md) のロール/所有権チェックを指す（本書はどのチェックが要るかのみ示す）。**種別** = `SSR`（hono/jsx ページ）/ `API`（island 用 JSON）/ `Analytics`（fire-and-forget）/ `Redirect`。

### 3.1 Discovery（PRD §23–28）

| Method | Path | 認証 | 認可 | Controller/Service | 種別 |
|---|---|---|---|---|---|
| GET | `/` | 不要 | – | `HomeController` → `GetHomeFeedService` | SSR |
| GET | `/search` | 不要 | – | `SearchController` → `SearchNovelsQuery` | SSR（初期表示） |
| GET | `/api/search` | 不要 | – | `SearchController` → `SearchNovelsQuery` | API（Search Filter island が絞込時に叩く） |
| GET | `/rankings` | 不要 | – | `RankingController`（`/rankings/daily` へ 302） | Redirect |
| GET | `/rankings/:period` | 不要 | – | `RankingController` → `GetRankingQuery`（`period`=daily/weekly/monthly/new/completed） | SSR |
| GET | `/tags/:tag` | 不要 | – | `DiscoveryController` → `BrowseByTagQuery` | SSR |
| GET | `/genres/:genre` | 不要 | – | `DiscoveryController` → `BrowseByGenreQuery` | SSR |
| GET | `/@{handle}` | 不要 | – | `UserProfileController` → `GetUserProfileService` | SSR |
| GET | `/@{handle}?tab=novels\|reviews\|library` | 不要（`library`はPrivate設定時に本人限定） | プロフィール非公開設定時は本人/フォロー可否チェック | `UserProfileController` | SSR（タブはクエリで表現しルート爆発を避ける） |

### 3.2 Reading（PRD §7–10, §17–21）

| Method | Path | 認証 | 認可 | Controller/Service | 種別 |
|---|---|---|---|---|---|
| GET | `/novels/{slug}` | 不要 | Visibility チェック（§4参照） | `NovelPermalinkController` | Redirect → `/@{handle}/{slug}` |
| GET | `/novels/{slug}/episodes/{episodeNo}` | 不要 | 同上 | `EpisodePermalinkController` | Redirect |
| GET | `/@{handle}/{slug}` | 不要 | Public: 誰でも。Unlisted: URL 知っていれば誰でも。Private: Owner/Collaborator(閲覧権限以上)のみ、それ以外 404 | `NovelController` → `GetNovelDetailService` | SSR |
| GET | `/@{handle}/{slug}/episodes/{episodeNo}` | 不要 | 上記に加え Episode が `draft` の場合は Owner/Collaborator のみ、それ以外 404 | `EpisodeReadController` → `GetEpisodeForReadingService` | SSR |
| GET | `/@{handle}/{slug}/continue` | 要（未ログインは `/@{handle}/{slug}` へ） | 本人の `reading_progress` のみ参照 | `NovelController` → `ResumeReadingService` | Redirect → 最終既読 Episode |
| POST | `/api/episodes/{episodeId}/reading-progress` | 要 | 本人 | `ReadingController` → `UpdateReadingProgressService` | API（読書中 island が随時 PATCH 相当で叩く） |
| PATCH | `/api/me/reader-settings` | 不要（未ログインは cookie のみ／要ログインなら `users` 拡張設定に将来保存） | 本人 | `ReaderSettingsController` | API（Reader Settings island。§4.1 [frontend.md](./frontend.md)） |
| POST | `/api/novels/{novelId}/library` | 要 | 本人 | `LibraryController` → `AddToLibraryService` | API |
| DELETE | `/api/novels/{novelId}/library` | 要 | 本人 | `LibraryController` | API |
| POST | `/api/episodes/{episodeId}/like` | 要 | 本人・Episode閲覧可であること | `SocialController` → `LikeEpisodeService` | API |
| DELETE | `/api/episodes/{episodeId}/like` | 要 | 本人 | `SocialController` | API |
| PUT | `/api/novels/{novelId}/star` | 要 | 本人 | `SocialController` → `RateNovelService` | API |
| GET | `/@{handle}/{slug}/reviews` | 不要 | Novel と同じ Visibility 制御 | `ReviewController` → `ListReviewsQuery` | SSR |
| POST | `/api/novels/{novelId}/reviews` | 要 | 本人・重複投稿は上書き（`UNIQUE(user_id,novel_id)`） | `ReviewController` → `CreateReviewService` | API |
| PATCH/DELETE | `/api/reviews/{reviewId}` | 要 | 投稿者本人 or Moderator | `ReviewController` | API |
| POST | `/api/episodes/{episodeId}/comments` | 要 | 本人・Episode閲覧可であること | `CommentController` → `PostCommentService` | API |
| DELETE | `/api/comments/{commentId}` | 要 | 投稿者本人 or Moderator | `CommentController` | API |
| POST/DELETE | `/api/users/{userId}/follow` | 要 | 本人（自己フォロー不可） | `FollowController` → `FollowUserService` | API |
| POST/DELETE | `/api/novels/{novelId}/follow` | 要 | 本人 | `FollowController` → `FollowNovelService` | API |
| GET | `/library` | 要 | 本人 | `LibraryController` → `GetMyLibraryQuery` | SSR |

### 3.3 Writing（PRD §11–16）— `/studio/*`、ID ベース

Studio 配下は全ルートで **要ログイン**。認可列は「対象 `novelId` に対する `collaborator_role`」を指す（詳細ロールマトリクスは [auth.md](./auth.md) / [collaboration-fork.md](./collaboration-fork.md)）。無資格アクセスは **403**。

| Method | Path | 認可（最低ロール） | Controller/Service | 種別 |
|---|---|---|---|---|
| GET | `/studio/novels` | ログインユーザー（自分が Owner/Collaborator の一覧） | `StudioNovelController` → `ListMyNovelsQuery` | SSR |
| GET | `/studio/novels/new` | ログインユーザー | `StudioNovelController` | SSR |
| POST | `/studio/novels` | ログインユーザー（作成者が自動的に Owner） | `StudioNovelController` → `CreateNovelService` | SSR フォーム送信（作成後 `/studio/novels/{novelId}/edit` へリダイレクト） |
| GET | `/studio/novels/{novelId}/edit` | Owner/Admin | `StudioNovelController` → `GetNovelForEditService` | SSR |
| PATCH | `/api/studio/novels/{novelId}` | Owner/Admin | `StudioNovelController` → `UpdateNovelMetadataService` | API |
| POST | `/api/studio/novels/{novelId}/slug` | Owner/Admin | `StudioNovelController` → `ChangeNovelSlugService` | API（可用性チェック込み） |
| DELETE | `/api/studio/novels/{novelId}` | Owner | `StudioNovelController` → `DeleteNovelService`（Soft Delete） | API |
| GET | `/studio/novels/{novelId}/episodes` | Owner/Admin/Writer/Editor/Viewer | `StudioEpisodeController` → `ListEpisodesForEditService` | SSR（目次・Chapter管理） |
| POST | `/api/studio/novels/{novelId}/chapters` | Owner/Admin/Writer | `StudioChapterController` → `CreateChapterService` | API |
| PATCH | `/api/studio/chapters/{chapterId}` | 同上 | `StudioChapterController` | API |
| PATCH | `/api/studio/novels/{novelId}/chapters/reorder` | 同上 | `StudioChapterController` → `ReorderChaptersService` | API |
| DELETE | `/api/studio/chapters/{chapterId}` | Owner/Admin | `StudioChapterController` | API |
| GET | `/studio/novels/{novelId}/episodes/new` | Owner/Admin/Writer | `StudioEpisodeController` | SSR（Editor island 込み） |
| GET | `/studio/novels/{novelId}/episodes/{episodeId}/edit` | Owner/Admin/Writer/Editor | `StudioEpisodeController` → `GetEpisodeDraftService` | SSR（Editor island） |
| PATCH | `/api/studio/episodes/{episodeId}` | Owner/Admin/Writer/Editor | `StudioEpisodeController` → `AutosaveEpisodeDraftService` | API（Editor autosave island） |
| POST | `/api/studio/episodes/{episodeId}/publish` | Owner/Admin/Writer | `StudioEpisodeController` → `PublishEpisodeService` | API |
| POST | `/api/studio/episodes/{episodeId}/schedule` | Owner/Admin/Writer | `StudioEpisodeController` → `SchedulePublishService` | API |
| DELETE | `/api/studio/episodes/{episodeId}/schedule` | 同上 | `StudioEpisodeController`（予約取消） | API |
| GET | `/studio/novels/{novelId}/episodes/{episodeId}/revisions` | Owner/Admin/Writer/Editor/Viewer | `RevisionController` → `ListRevisionsQuery` | SSR（[writing-revision.md](./writing-revision.md)） |
| GET | `/api/studio/episodes/{episodeId}/revisions/{revisionId}/diff` | 同上 | `RevisionController` → `DiffRevisionsQuery` | API |
| POST | `/api/studio/episodes/{episodeId}/revisions/{revisionId}/restore` | Owner/Admin/Writer | `RevisionController` → `RestoreRevisionService` | API |
| GET | `/studio/novels/{novelId}/collaborators` | Owner/Admin | `CollaboratorController` → `ListCollaboratorsQuery` | SSR |
| POST | `/api/studio/novels/{novelId}/collaborators/invitations` | Owner/Admin | `CollaboratorController` → `InviteCollaboratorService` | API |
| PATCH | `/api/studio/collaborators/{collaboratorId}` | Owner/Admin | `CollaboratorController` → `ChangeRoleService` | API |
| DELETE | `/api/studio/collaborators/{collaboratorId}` | Owner/Admin | `CollaboratorController` | API |
| GET | `/me/invitations` | ログインユーザー（自分宛て） | `InvitationController` → `ListMyInvitationsQuery` | SSR |
| POST | `/api/invitations/{invitationId}/accept` | 招待対象本人 | `InvitationController` → `RespondInvitationService` | API |
| POST | `/api/invitations/{invitationId}/decline` | 招待対象本人 | `InvitationController` | API |
| POST | `/@{handle}/{slug}/fork` | ログインユーザー（`fork_policy` に従う） | `ForkController` → `ForkNovelService`（[collaboration-fork.md](./collaboration-fork.md)） | SSR フォーム送信（作成後 Studio 新 Novel へリダイレクト） |
| GET | `/@{handle}/{slug}/proposals` | 不要 | Visibility 準拠（Public/Unlisted 閲覧可） | `ChangeProposalController` → `ListProposalsQuery` | SSR |
| POST | `/api/novels/{novelId}/proposals` | ログインユーザー | `ChangeProposalController` → `CreateProposalService` | API |
| GET | `/@{handle}/{slug}/proposals/{proposalId}` | 不要 | 同上 | `ChangeProposalController` | SSR |
| POST | `/api/proposals/{proposalId}/comments` | ログインユーザー | `ChangeProposalController` → `CommentProposalService` | API |
| POST | `/api/proposals/{proposalId}/accept` | 対象 Novel の Owner/Admin | `ChangeProposalController` → `AcceptProposalService` | API |
| POST | `/api/proposals/{proposalId}/reject` | 同上 | `ChangeProposalController` | API |
| POST | `/api/proposals/{proposalId}/withdraw` | 提案者本人 | `ChangeProposalController` | API |

### 3.4 Social / Notification（PRD §21–22）

| Method | Path | 認証 | 認可 | Controller/Service | 種別 |
|---|---|---|---|---|---|
| GET | `/notifications` | 要 | 本人 | `NotificationController` → `ListNotificationsQuery` | SSR |
| GET | `/api/notifications/unread-count` | 要 | 本人 | `NotificationController` | API（通知 island のポーリング/バッジ） |
| PATCH | `/api/notifications/{notificationId}/read` | 要 | 本人 | `NotificationController` → `MarkReadService` | API |
| PATCH | `/api/notifications/read-all` | 要 | 本人 | `NotificationController` | API |
| POST | `/api/users/{userId}/block` | 要 | 本人 | `SafetyController` → `BlockUserService` | API |
| DELETE | `/api/users/{userId}/block` | 要 | 本人 | `SafetyController` | API |
| POST | `/api/users/{userId}/mute` | 要 | 本人 | `SafetyController` → `MuteUserService` | API |
| DELETE | `/api/users/{userId}/mute` | 要 | 本人 | `SafetyController` | API |

### 3.5 Analytics（PRD §29–36, §51）

| Method | Path | 認証 | 認可 | Controller/Service | 種別 |
|---|---|---|---|---|---|
| POST | `/api/analytics/events` | 不要（匿名 session_id 可、ログイン時は user_id 併記） | – | `AnalyticsIngestController` → `RecordEventService` | **Analytics（fire-and-forget）**。読書操作をブロックしない（PRD §55, [architecture.md](./architecture.md) §7） |
| GET | `/studio/novels/{novelId}/analytics` | Owner/Admin/Writer | 同左 | `AnalyticsDashboardController` → `GetAnalyticsOverviewQuery` | SSR |
| GET | `/studio/novels/{novelId}/analytics/episodes/{episodeId}` | 同上 | `AnalyticsDashboardController` → `GetEpisodeAnalyticsQuery` | SSR |
| GET | `/studio/novels/{novelId}/analytics/funnel` | 同上 | `AnalyticsDashboardController` → `GetReadingFunnelQuery` | SSR |
| GET | `/studio/novels/{novelId}/analytics/acquisition` | 同上 | `AnalyticsDashboardController` → `GetAcquisitionQuery` | SSR |
| GET | `/studio/novels/{novelId}/analytics/retention` | 同上 | `AnalyticsDashboardController` → `GetRetentionQuery` | SSR |
| GET | `/api/studio/novels/{novelId}/analytics/realtime` | 同上 | `AnalyticsDashboardController` → `GetRealtimeReadersQuery` | API（Realtime island のポーリング/SSE） |
| GET | `/api/studio/novels/{novelId}/analytics/episodes/{episodeId}/chart` | 同上 | `AnalyticsDashboardController` | API（Analytics Graph island 用データ） |

### 3.6 Auth（PRD §52。詳細は [auth.md](./auth.md)）

| Method | Path | 認証 | 認可 | Controller/Service | 種別 |
|---|---|---|---|---|---|
| GET | `/login` | 未ログイン限定（ログイン中は `/` へ） | – | `AuthController` | SSR |
| POST | `/login` | 同上 | – | `AuthController` → `LoginService` | SSR フォーム送信 |
| GET | `/signup` | 未ログイン限定 | – | `AuthController` | SSR |
| POST | `/signup` | 同上 | – | `AuthController` → `SignupService` | SSR フォーム送信 |
| POST | `/logout` | 要 | 本人 | `AuthController` → `LogoutService` | SSR フォーム送信/API 両対応 |
| GET | `/oauth/{provider}/start` | 不要 | – | `OAuthController` | Redirect（Provider へ） |
| GET | `/oauth/{provider}/callback` | 不要 | – | `OAuthController` → `OAuthCallbackService` | Redirect（成功後 `/`） |
| GET | `/settings/account` | 要 | 本人 | `AccountSettingsController` | SSR |
| PATCH | `/api/me` | 要 | 本人 | `AccountSettingsController` → `UpdateProfileService` | API |
| POST | `/api/me/password` | 要 | 本人 | `AccountSettingsController` → `ChangePasswordService` | API |
| DELETE | `/api/me` | 要 | 本人（要再認証） | `AccountSettingsController` → `DeleteAccountService` | API |

### 3.7 Moderation / Admin（PRD §37。詳細は [moderation.md](./moderation.md)）

| Method | Path | 認証 | 認可 | Controller/Service | 種別 |
|---|---|---|---|---|---|
| POST | `/api/reports` | 要 | ログインユーザー全員 | `ReportController` → `CreateReportService` | API |
| GET | `/admin/reports` | 要 | Moderator/Admin ロール（プラットフォーム権限。Novel の Collaborator ロールとは別軸） | `AdminReportController` → `ListReportsQuery` | SSR |
| GET | `/admin/reports/{reportId}` | 要 | 同上 | `AdminReportController` | SSR |
| PATCH | `/api/admin/reports/{reportId}` | 要 | 同上 | `AdminReportController` → `ResolveReportService` | API |
| POST | `/api/admin/novels/{novelId}/hide` | 要 | 同上 | `AdminModerationController` → `HideNovelService` | API |
| POST | `/api/admin/episodes/{episodeId}/hide` | 要 | 同上 | `AdminModerationController` → `HideEpisodeService` | API |
| DELETE | `/api/admin/comments/{commentId}` | 要 | 同上 | `AdminModerationController` | API |
| DELETE | `/api/admin/reviews/{reviewId}` | 要 | 同上 | `AdminModerationController` | API |
| POST | `/api/admin/users/{userId}/suspend` | 要 | 同上 | `AdminUserController` → `SuspendUserService` | API |
| POST | `/api/admin/users/{userId}/ban` | 要 | 同上 | `AdminUserController` → `BanUserService` | API |
| POST | `/api/admin/users/{userId}/reinstate` | 要 | 同上 | `AdminUserController` | API |

---

## 4. SSR / island用 API / Analytics fire-and-forget の区分

| 種別 | URL 空間 | 特徴 | 例 |
|---|---|---|---|
| **SSR ページ** | `/`, `/@{handle}/...`, `/studio/...`, `/notifications` 等（`/api` を含まない全パス） | `hono/jsx` で HTML を返す。ページ全体を返却し、必要な island だけ埋め込む（[frontend.md](./frontend.md) §1）。認可失敗時の挙動は §6。 | `GET /@{handle}/{slug}` |
| **island 用 JSON API** | `/api/**`（Analytics 以外） | 認証セッションは Cookie 経由で共有。レスポンスは JSON。CSRF 対策必須（[architecture.md](./architecture.md) §9）。Editor autosave・Reader Settings・Search Filter・Notification・Analytics Graph・Realtime の各 island が叩く。 | `PATCH /api/studio/episodes/{episodeId}` |
| **Analytics fire-and-forget** | `POST /api/analytics/events` の一本のみ | 呼び出し元（読書画面等）の操作を**ブロックしない**（`navigator.sendBeacon` 等を想定）。認証は任意（匿名可）。バリデーション失敗も 202 相当で握りつぶし、UX に影響を与えない（PRD §55, [architecture.md](./architecture.md) §7）。 | `POST /api/analytics/events` |

- **Controller 分離の指針**: `/api/**` 配下は Presentation 内で SSR Controller と物理的に別ファイル/別ディレクトリ（`presentation/controllers/api/` 等）に置き、認可・レスポンス形式（JSON vs HTML）の混在を避ける。ただし Application Service は SSR/API で共用する（Controller だけが薄く分かれる）。

---

## 5. canonical / noindex の決定ルール

[frontend.md](./frontend.md) §7・PRD §56 と整合。

| 条件 | canonical | robots meta | 備考 |
|---|---|---|---|
| Novel/Episode の `visibility = public` かつ `content_state = visible` | 自ページの正規 URL（`/@{handle}/{slug}[/episodes/{episodeNo}]`） | `index, follow` | title/description/OGP/Structured Data(JSON-LD `CreativeWork`/`Article`相当)を付与 |
| `visibility = unlisted` | 自ページの正規 URL（一応 canonical は出す） | `noindex, follow` | URL を知っていれば閲覧可。検索・ランキング・おすすめ・新着からは Query 層で除外（PRD §9） |
| `visibility = private` | – | `noindex, nofollow` | 非権限者には後述 404 を返すため実質到達不可。権限者が閲覧する場合のみ meta 付与 |
| `content_state = hidden`（モデレーション） | – | `noindex, nofollow` | 一般閲覧者には 404（§6） |
| `/novels/{slug}` 系パーマリンク | 対象は 302 Redirect 先の正規 URL（HTTP レスポンスの `Location`） | （リダイレクトのため meta 不要） | クローラは Redirect を辿り正規 URL を index する |
| `/studio/**`, `/admin/**`, `/api/**`, `/notifications`, `/library`, `/settings/**` | – | `noindex, nofollow` | 個人化・非公開ページは一律 noindex |
| `/search`, `/rankings/:period`, `/tags/:tag`, `/genres/:genre` | 自ページ（クエリパラメータ付き検索結果は canonical をクエリなしの一覧ページに正規化） | `index, follow`（一覧トップのみ） | フィルタ組み合わせページの重複 index を避けるため、絞り込みクエリ付き URL は canonical をベースパスに向ける |

- meta 生成は SSR View 側（Presentation）で一元化し、`visibility`/`content_state` を Application Service のレスポンス DTO に含めて View へ渡す（Domain が HTTP/SEO の関心を持たない、[architecture.md](./architecture.md) の依存方向を維持）。

---

## 6. エラールーティング（404 / 403）

| ケース | ステータス | 理由 |
|---|---|---|
| 存在しない `handle` / `slug` / `episodeNo` | 404 | 通常の Not Found |
| `visibility = private` の Novel/Episode に非権限者がアクセス | **404**（403 にしない） | 存在の秘匿。403 を返すと「存在はするが見えない」ことが漏れ、非公開作品の存在自体がプライバシー情報になりうる（PRD §58 準拠） |
| `episode_status = draft` の Episode に非権限者がアクセス | **404** | 同上（未公開であることを外部に漏らさない） |
| `content_state = hidden`（モデレーションで非表示） | **404**（一般閲覧者）／通報者・本人には状態を明示する専用画面 | モデレーション事実を一般には非公開 |
| `/studio/**` に対象 Novel の Collaborator でないユーザーがログイン状態でアクセス | **403** | ログイン済みで「権限がない」ことを明示してよい（存在は当人が既に知っている前提の管理画面） |
| `/admin/**` に Moderator/Admin 権限のないユーザーがアクセス | **403** | 同上 |
| 未ログインで要ログインページにアクセス | **302 → `/login?redirect=...`** | エラーではなく認証フローへ誘導 |
| API (`/api/**`) の認可失敗 | **403**（存在秘匿が必要な対象は 404、上記表と同基準） | JSON ボディで `{ error: { code, message } }` を返す |
| API のバリデーション失敗 | **422** | |
| 汎用サーバエラー | **500**（詳細はログのみ、レスポンスに内部情報を含めない） | PRD §59 |

- 404/403 ページも SSR（`hono/jsx`）で描画し、`noindex, nofollow` を付与する。

---

## 7. REST 的規約・Controller 分割方針

- **命名**: リソースは複数形（`episodes`, `collaborators`, `reviews`）。単一リソースの子アクションは動詞サブリソース化する（`.../publish`, `.../follow`, `.../accept`）— PATCH の意味が曖昧になる操作（公開・招待承諾など状態遷移）は POST + 動詞パスを許容する（RPC 的だが Use Case 単位で意味が明確になるため採用。純粋 REST の `PATCH {status: "published"}` は状態遷移の副作用（通知発火・Revision 追記等）を隠してしまい可読性が落ちるため不採用）。
- **ネスト深さは最大2階層**: `/api/studio/novels/{novelId}/collaborators/invitations` のように3階層以上になる場合は、末尾のコレクションを独立リソースとして `invitationId` で以降のアクセスをフラット化する（`/api/invitations/{invitationId}/accept` のように）。
- **SSR は slug/handle、API は ID**: 人間が触れる URL（ナビゲーション・共有）は slug/handle、island やシステム間連携は UUID の `novelId`/`episodeId` を使う。これにより slug 変更が API クライアント（island の JS）に影響しない。
- **Controller はドメイン集約単位**で分割する（`NovelController` / `EpisodeController` / `CollaboratorController` / `ChangeProposalController` / `ReviewController` / `CommentController` / `FollowController` / `NotificationController` / `AnalyticsDashboardController` / `AdminReportController` 等）。1 Controller = 1 Application Service 呼び出しが原則（[architecture.md](./architecture.md) §5.1「Controller に業務ロジックを書かない」）。
- **SSR 用と API 用で Controller を分ける**: 同じ Novel リソースでも `NovelController`（SSR, 公開閲覧）と `StudioNovelController`（SSR, 著者管理）と API ルート群は別クラスにし、認可要件・レスポンス形式の混在を避ける。Application Service（`GetNovelDetailService` 等）は共有してよい。
- **バージョニング**: 現時点で `/api/v1/` のような明示バージョニングは導入しない（外部公開 API ではなく自社 island 専用のため）。将来外部公開 API を出す場合に `/api/v1/` を切る（未決事項）。

---

## 8. 未決事項

1. **slug 変更時の 301 リダイレクト**: 本書では旧 slug への恒久リダイレクトを実装せず、`/novels/{slug}` パーマリンクのみで恒久性を担保する設計とした。旧 slug 保存が必要になった場合 `novel_slug_history(novel_id, old_slug, created_at)` を [data-model.md](./data-model.md) に追加する必要がある。
2. **handle 変更時の旧 URL 救済**: 現状は旧 handle 配下 URL を即 404 とする設計。ユーザー体験上リダイレクトを残したい場合は `user_handle_history` テーブルの追加要否を検討（[data-model.md](./data-model.md) 未決事項と合わせて要調整）。
3. **Moderator/Admin ロールの実装位置**: `collaborators.role`（Novel スコープ）とは別に、プラットフォーム全体の Moderator/Admin ロールをどのテーブル/フラグで表現するか（`users` への追加列か別表か）は [auth.md](./auth.md) / [moderation.md](./moderation.md) で確定させる。本書はルート表上で「Moderator/Admin ロール」とだけ仮置きしている。
4. **検索結果 URL のクエリパラメータ設計**（`?q=`, `?genre=`, `?sort=` 等の正式なパラメータ名・複数値の表現）は [discovery.md](./discovery.md) で確定し、本書は参照のみに留める。
5. **Reader Settings のサーバ永続化要否**: 現状 localStorage 主体（[frontend.md](./frontend.md)）。ログインユーザーへのクロスデバイス同期が必要になった場合、`PATCH /api/me/reader-settings` の永続化先（`users` 拡張 or 専用表）を [data-model.md](./data-model.md) 側で確定する必要がある。
6. **外部公開 API のバージョニング要否**（§7）は将来のサードパーティ連携要件次第。
