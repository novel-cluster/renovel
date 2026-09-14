# ReNovel PRD

## 1. Product Overview

### 1.1 Product Name

**ReNovel**

### 1.2 Summary

ReNovelは、Web小説を読む読者を第一に考えつつ、作者に対して高度な執筆・共同制作・分析機能を提供する小説投稿プラットフォームである。

既存のWeb小説投稿サイトが持つ、

- 投稿
- 閲覧
- 評価
- コメント
- フォロー
- ランキング

といった基本機能を提供しながら、特に以下をReNovelの強みとする。

1. 高品質な執筆UX
2. Google Analytics級の作品分析
3. 複数作者による共同制作
4. GitHubのForkに近い派生作品機能
5. 快適かつシンプルな読書体験

表紙画像は扱わず、タイトル・キャッチコピー・文章そのものを中心としたWeb小説体験を提供する。

---

# 2. Goals

## 2.1 Primary Goals

### 読者

- 読みたい作品を簡単に発見できる
- 小説本文に集中できる
- 続きからすぐに読める
- 好きな作品や作者を追跡できる
- 作品に対して感想や評価を残せる

### 作者

- 小説をストレスなく執筆できる
- 自動保存やRevisionによって安全に執筆できる
- 他ユーザーと共同執筆できる
- 読者がどこまで読んだか、どこで離脱したかを分析できる
- 読者からの反応を詳細に確認できる

---

# 3. Non-Goals

初期リリースでは以下を必須要件としない。

- 電子書籍販売
- 有料エピソード
- サブスクリプション
- 作者への広告収益還元
- 投げ銭
- ネイティブモバイルアプリ
- リアルタイム同時編集
- AIによる小説生成
- 音声読み上げ

収益化については将来機能として検討する。

---

# 4. Target Users

## 4.1 Primary Target

Web小説を日常的に読むユーザー。

## 4.2 Secondary Target

- Web小説作者
- 複数人で作品を制作する作者
- 二次創作・派生作品作者
- 自作品の読者行動を分析したい作者

---

# 5. Product Principles

ReNovelでは以下を重要な設計原則とする。

## Reader First

第一に読者体験を優先する。

作者向け機能を充実させる場合でも、読書画面を複雑化させない。

## Text First

表紙画像ではなく文章を中心にする。

作品一覧でも画像を前提としない。

## Writing Should Be Invisible

作者が記法やツールの操作を意識しすぎず、文章そのものに集中できることを目指す。

## Data Helps Writers

PVだけではなく、

- 読了率
- 離脱
- 読書時間
- Episode遷移

などを作者へ提供する。

## Collaboration Is Native

共同制作を後付け機能ではなく、作品モデルそのものに組み込む。

---

# 6. User Model

読者アカウントと作者アカウントを分離しない。

すべての登録ユーザーは、

- 小説を読む
- 小説を投稿する
- 他ユーザーをフォローする
- 評価する
- コメントする
- 共同制作へ参加する

ことができる。

## 6.1 User Fields

- ID
- User ID / Handle
- Display Name
- Profile Icon
- Biography
- External Links
- Created At
- Updated At

URL：

`/@{handle}`

例：

`/@tanahiro2010`

---

# 7. Novel

## 7.1 Structure

基本構造：

```text
Novel
├ Chapter
│  └ Episode
└ Episode
```

Chapterは任意。

Chapterを利用しない作品ではNovel直下へEpisodeを配置する。

短編はEpisodeを1つのみ持つNovelとして扱う。

---

## 7.2 Novel Metadata

作品は以下の情報を持つ。

- Title
- Catchphrase
- Description
- Genre
- Tags
- Publication Status
- Visibility
- Content Warnings
- Owner
- Collaborators
- Fork Policy
- Original Novel
- Created At
- Updated At
- Published At

表紙画像フィールドは持たない。

---

# 8. Publication Status

以下を利用する。

- Ongoing
- Completed
- Hiatus

Draftは作品状態ではなくVisibilityによって表現する。

---

# 9. Visibility

## Public

誰でも閲覧可能。

検索・ランキング・おすすめ等の対象となる。

## Unlisted

URLを知っているユーザーのみ閲覧可能。

原則として以下には表示しない。

- 検索
- ランキング
- おすすめ
- 新着一覧

## Private

Ownerおよび閲覧権限を持つCollaboratorのみ閲覧可能。

---

# 10. Content Warning

作者は作品にContent Warningを設定できる。

例：

- R15相当
- 暴力描写
- 残酷描写
- 性的表現
- その他

必要に応じて閲覧前に警告画面を表示する。

---

# 11. Editor

## 11.1 Philosophy

Markdown Editorにはしない。

通常のプレーンテキスト執筆を基本とする。

---

## 11.2 Ruby

以下の記法をサポートする。

```text
｜文章《ルビ》
```

表示時：

```html
<ruby>
  文章
  <rt>ルビ</rt>
</ruby>
```

---

## 11.3 Emphasis

以下を傍点として扱う。

```text
《《文章》》
```

---

## 11.4 Editor Features

必須機能：

- 自動保存
- 手動保存
- Preview
- 文字数表示
- Draft
- Publish
- Scheduled Publish
- Revision History
- Revision Restore

将来的に、

- 全文置換
- 検索
- メモ
- Character管理
- Plot管理

なども検討する。

---

# 12. Revision System

Episodeの内容は単純な上書きだけでは管理しない。

```text
Episode
└ EpisodeRevision[]
```

Revisionには以下を保存する。

- Episode ID
- Editor User ID
- Title
- Body
- Created At

必要に応じて変更内容も記録する。

作者は過去Revisionを閲覧し、復元できる。

---

# 13. Collaboration

Novelは複数ユーザーによって管理できる。

## Roles

### Owner

全権限。

- Novel削除
- 設定変更
- Collaborator管理
- Role変更
- Episode作成
- Episode編集
- Publish

### Admin

- Novel設定変更
- Collaborator管理
- Episode管理
- Publish

### Writer

- Episode作成
- Episode編集
- Draft保存

### Editor

- Episode編集
- Revision作成

### Viewer

- Private Novel
- Draft Episode

などの閲覧のみ可能。

---

# 14. Fork

ユーザーは許可されたNovelから派生作品を作成できる。

ForkされたNovelには派生元を必ず表示する。

例：

```text
Forked from:
「神は勇者を選ばない」
```

原作側でもFork一覧を確認可能。

---

# 15. Fork Policy

Ownerは以下から設定する。

- Disabled
- Approval Required
- Allowed

Forkされた作品では原作品への帰属表示を削除できない。

---

# 16. Change Proposal

Forkまたは共同制作に関連して、

**変更提案**

機能を提供することを検討する。

GitHub Pull Requestに近いモデルとする。

例：

```text
Alice proposed changes

Episode 3
+ 3 paragraphs
- 1 paragraph
```

Ownerまたは権限を持つCollaboratorが、

- Accept
- Reject
- Comment

できる。

1.0への導入を目標とするが、Fork本体より優先度は低い。

---

# 17. Reader

読書画面は本文への集中を最優先とする。

## Reader Settings

ユーザーは以下を変更できる。

- Font Size
- Line Height
- Content Width
- Font
- Writing Direction
- Theme

Theme：

- Light
- Dark
- Sepia

Writing Direction：

- Horizontal
- Vertical

---

# 18. Reading Progress

ユーザーごとに以下を記録する。

- 最後に読んだEpisode
- 最後に読んだ位置
- 読了済みEpisode
- 最終閲覧日時

作品ページでは、

**続きから読む**

を提供する。

---

# 19. Library

ユーザーはNovelをLibraryへ保存できる。

標準状態：

- Reading
- Read Later
- Completed
- Favorite

将来的にはCustom Collectionを作成可能にする。

---

# 20. Social Features

## 20.1 Like

Episode単位。

意味：

「この話が良かった」

1ユーザーにつき1Episode 1Like。

取り消し可能。

---

## 20.2 Star

Novel単位。

作品全体への評価。

1〜3 Stars。

---

## 20.3 Review

Novel単位。

以下を持つ。

- Stars
- Title
- Body
- User
- Created At

---

## 20.4 Comment

基本的にEpisode単位。

ユーザーはEpisode読了後に感想を投稿できる。

将来的にParagraph Commentも検討する。

---

# 21. Follow

## User Follow

ユーザーをフォローする。

## Novel Follow

Novelをフォローする。

Novel Followは更新通知に利用する。

---

# 22. Notifications

以下を通知対象とする。

- User Follow
- Novel Follow
- Like
- Star
- Review
- Comment
- Novel Update
- Collaboration Invite
- Fork
- Change Proposal

初期通知：

- In-App Notification

将来的に：

- Web Push
- Email

---

# 23. Search

検索対象：

- Novel Title
- Catchphrase
- Description
- User
- Tag

---

# 24. Search Filters

- Genre
- Tags
- Ongoing
- Completed
- Word Count
- Updated At

---

# 25. Search Sorting

- Popular
- New
- Recently Updated
- Rating
- Word Count

---

# 26. Ranking

以下のランキングを提供する。

- Daily
- Weekly
- Monthly
- New
- Completed

ランキングは累積PVのみで決定しない。

以下をスコアとして利用する。

- Unique Readers
- Reading Completion
- Likes
- Stars
- Bookmarks
- Novel Follows

時間減衰を導入する。

具体的なRanking Algorithmは別仕様とする。

---

# 27. Recommendations

ユーザーに作品を推薦する。

初期はRule Based Recommendationを使用可能。

Signals：

- Read History
- Completed Novels
- Likes
- Stars
- Library
- Follow
- Tags
- Genres

将来的に推薦システムを高度化できる構造とする。

---

# 28. Home

ログインユーザー：

- Continue Reading
- Followed Novel Updates
- Recommendations
- Weekly Ranking
- New Novels
- Completed Novels

ゲスト：

- Ranking
- New Novels
- Completed Novels
- Featured Novels

---

# 29. Analytics

ReNovelの主要機能の一つ。

目標：

**作者向けGoogle Analytics**

---

# 30. Analytics Overview

Novel単位で以下を表示する。

- Page Views
- Unique Readers
- Likes
- Stars
- Comments
- Reviews
- Novel Follows
- Library Adds

期間：

- Today
- Yesterday
- 7 Days
- 30 Days
- Custom Range

---

# 31. Episode Analytics

Episodeごとに以下を提供する。

- Views
- Unique Readers
- Average Reading Time
- Completion Rate
- Scroll Progress
- Likes
- Comments

---

# 32. Reading Funnel

Episode間の読者遷移を可視化する。

例：

```text
Episode 1    100%
    ↓
Episode 2     89%
    ↓
Episode 3     82%
    ↓
Episode 4     53%
```

作者が、

「Episode 3 → Episode 4で多くの読者が離脱した」

ことを確認可能にする。

---

# 33. Acquisition Analytics

読者がどこから来たかを表示する。

例：

- Google
- X
- Direct
- ReNovel Search
- ReNovel Ranking
- ReNovel Recommendation
- External Website

UTM Parameterにも対応可能な構造とする。

---

# 34. Realtime Analytics

現在作品を読んでいるユーザー数を表示する。

例：

```text
Active Readers: 23

Episode 1    5
Episode 2    3
Episode 8    7
Episode 14   8
```

厳密な秒単位Realtimeである必要はない。

---

# 35. Retention Analytics

以下を分析可能にする。

- Next Day Return
- 7 Day Return
- 30 Day Return
- 新Episode公開後の復帰率

---

# 36. Analytics Events

例：

```text
novel_view
episode_view
episode_read_start
episode_progress_25
episode_progress_50
episode_progress_75
episode_complete
next_episode
like
star
review
comment
follow
library_add
search_click
recommendation_click
```

Eventには必要最低限の情報のみ保存する。

Analytics目的以上の不要なユーザー追跡を行わない。

---

# 37. Moderation

## User Features

- Report User
- Report Novel
- Report Episode
- Report Comment
- Report Review
- Block User
- Mute User

## Admin Features

- Report Management
- Hide Novel
- Hide Episode
- Delete Comment
- Delete Review
- Suspend User
- Ban User

---

# 38. Monetization

ReNovel 1.0では必須機能としない。

将来的に以下を検討する。

- Advertising
- Creator Revenue Share
- Revenue Split
- Payout

広告ProviderやPayout Providerは審査・法務・手数料を踏まえて別途決定する。

---

# 39. Technical Architecture

## 39.1 Core Policy

ReNovelはHono Conferenceでの紹介を想定し、Webアプリケーションの中心をHonoで構築する。

基本的にSPA Frameworkへ依存しない。

---

# 40. Technology Stack

## Runtime

Bunを第一候補とする。

## Framework

Hono

## Server Rendering

hono/jsx

## Client Rendering

hono/jsx/dom

必要なInteractive UIのみに使用する。

## UI Components

Kiwa UIを第一候補とする。

不足するComponentは独自実装する。

## Database

PostgreSQL

## ORM

Drizzle ORM

## Infrastructure

- Docker
- Docker Compose
- Self Hosted Server
- Cloudflare Tunnel

---

# 41. Architecture Pattern

ReNovelでは、

**DDD + MVC + Service Layer**

を採用する。

俗に、

**DDD + MVC + S**

とする。

---

# 42. Domain Driven Design

主要Domain候補：

```text
Identity
Novel
Writing
Collaboration
Fork
Reading
Social
Discovery
Analytics
Notification
Moderation
```

Domain間の責務を明確に分割する。

---

# 43. MVC

HonoのHTTP LayerではMVCを利用する。

## Controller

HTTP Requestを受け取り、

- Inputの取得
- Authentication Context取得
- Service呼び出し
- Response生成

を行う。

ControllerにBusiness Logicを書かない。

## View

hono/jsxによるSSR View。

## Model

Domain Entity / Value Object等を利用する。

---

# 44. Service Layer

Application ServiceとしてUse Caseを実装する。

例：

```text
CreateNovelService
PublishEpisodeService
ForkNovelService
InviteCollaboratorService
AddNovelReviewService
GetNovelAnalyticsService
```

Serviceは、

- Domain
- Repository

を利用してUse Caseを実行する。

---

# 45. Layer Structure

概念的には以下。

```text
Presentation
     ↓
Application
     ↓
Domain
     ↑
Infrastructure
```

---

# 46. Directory Structure

初期案：

```text
src/
├ app.ts
│
├ presentation/
│  ├ controllers/
│  ├ routes/
│  ├ views/
│  ├ components/
│  └ middleware/
│
├ application/
│  ├ services/
│  ├ dto/
│  └ queries/
│
├ domain/
│  ├ identity/
│  ├ novel/
│  ├ writing/
│  ├ collaboration/
│  ├ fork/
│  ├ reading/
│  ├ social/
│  ├ analytics/
│  ├ discovery/
│  └ notification/
│
├ infrastructure/
│  ├ database/
│  │  ├ drizzle/
│  │  ├ schema/
│  │  └ repositories/
│  ├ storage/
│  └ external/
│
└ shared/
   ├ errors/
   ├ utils/
   └ types/
```

---

# 47. Domain Example

Novel Domain：

```text
domain/novel/
├ entities/
│  ├ novel.ts
│  ├ chapter.ts
│  └ episode.ts
│
├ value-objects/
│  ├ novel-title.ts
│  ├ novel-status.ts
│  └ visibility.ts
│
├ repositories/
│  └ novel-repository.ts
│
├ services/
│  └ novel-domain-service.ts
│
└ errors/
```

Repository InterfaceはDomain/Application側へ置き、

Drizzle実装はInfrastructureへ配置する。

---

# 48. Request Flow

例：Episode公開。

```text
POST /novels/:novelId/episodes/:episodeId/publish
                    │
                    ▼
           EpisodeController
                    │
                    ▼
        PublishEpisodeService
                    │
          ┌─────────┴─────────┐
          ▼                   ▼
      Episode             Repository
      Domain                  │
                              ▼
                         PostgreSQL
```

Controllerは薄く保つ。

---

# 49. SSR Request Flow

作品閲覧：

```text
GET /novels/:slug
        │
        ▼
NovelController
        │
        ▼
GetNovelService
        │
        ▼
NovelRepository
        │
        ▼
PostgreSQL
        │
        ▼
NovelView
        │
        ▼
hono/jsx
        │
        ▼
HTML
```

---

# 50. Client Components

hono/jsx/domを利用する候補：

- Editor Autosave
- Reader Settings
- Analytics Graph
- Notification UI
- Search Filter
- Realtime Analytics

ページ全体をClient Renderingすることは原則避ける。

---

# 51. Analytics Architecture

Analyticsイベントを通常のTransactional Dataから分離する。

概念：

```text
Browser
   ↓
Analytics Endpoint
   ↓
Event Store
   ↓
Aggregation
   ↓
Analytics Tables
   ↓
Dashboard
```

想定Table：

```text
analytics_events
analytics_hourly
analytics_daily
```

アクセス増加時にAnalytics部分だけ別サービスへ切り離せる設計とする。

---

# 52. Authentication

具体的Providerは別途決定する。

最低限、

- Session Authentication
- OAuth

を想定。

Authentication ContextをHono Contextへ設定する。

例：

```text
c.get("user")
c.get("session")
```

Domain層はHono Contextへ依存しない。

---

# 53. Database Principles

- PostgreSQLをSource of Truthとする
- Foreign Keyを可能な限り利用する
- Migrationを必須とする
- Soft Deleteが必要なDomainを明示する
- Analytics DataとTransactional Dataを分離する
- Repository経由でDomainからDB実装を隠蔽する

---

# 54. Deployment

Docker Composeを利用する。

例：

```text
services:
  web
  postgres
```

必要になった場合、

```text
redis
worker
analytics-worker
```

等を追加する。

Production：

```text
Cloudflare
    ↓
Cloudflare Tunnel
    ↓
Docker Host
    ↓
ReNovel
    ↓
PostgreSQL
```

外部からサーバーへ直接Port Forwardingしない。

---

# 55. Performance Requirements

目標：

- SSRページを高速に返す
- Reader画面で不要なJavaScriptを配信しない
- 検索・作品表示でN+1を発生させない
- Analytics Event送信が読書操作をBlockingしない
- Reader SettingsによるLayout Shiftを最小化する

---

# 56. SEO

Public Novel / Episodeは検索EngineにIndex可能とする。

各ページに、

- title
- description
- canonical
- Open Graph
- Structured Data

を設定する。

Unlisted / PrivateはIndexさせない。

---

# 57. Accessibility

最低限、

- Keyboard Navigation
- Semantic HTML
- Appropriate Contrast
- aria attributes
- Screen Reader対応

を考慮する。

読書画面では特に文字サイズ・行間の変更に耐えられる設計とする。

---

# 58. Privacy

Analyticsを強力にする一方で、不必要な個人追跡は行わない。

作者へ、

「誰が何時何分にどこまで読んだ」

といった個人単位の行動履歴を公開しない。

作者Analyticsは原則Aggregationされた情報として提供する。

---

# 59. Security

最低限以下を実施する。

- CSRF対策
- XSS対策
- SQL Injection対策
- Rate Limiting
- Session Security
- Permission Check
- Content Security Policy
- Secure Cookie
- Input Validation

特にCollaborator RoleやPrivate Novelについては、UIだけではなくServer Sideで必ずAuthorizationを行う。

---

# 60. ReNovel 1.0 Definition of Done

以下がProduction環境で利用可能であること。

## Reader

- Novel閲覧
- Episode閲覧
- Reader Settings
- Reading Progress
- Library
- Search
- Ranking
- Recommendation
- Follow

## Author

- Novel作成
- Novel編集
- Chapter管理
- Episode管理
- Editor
- Ruby
- Emphasis
- Autosave
- Draft
- Publish
- Scheduled Publish
- Revision History

## Collaboration

- Collaborator Invite
- Role Management
- Collaborative Editing
- Fork
- Fork Policy

## Social

- Like
- Star
- Review
- Comment
- User Follow
- Novel Follow
- Notification

## Analytics

- Overview
- Episode Analytics
- Reading Funnel
- Acquisition
- Realtime
- Retention

## Administration

- Report
- Block
- Mute
- Moderation
- User Suspension / Ban

---

# 61. Future Features

ReNovel 1.x以降で検討する。

- Creator Monetization
- Advertising Revenue Share
- Payout
- Paragraph Comments
- Advanced Change Proposal
- Real-time Collaborative Editor
- Custom Library Collections
- Advanced Recommendation Engine
- Web Push
- Email Notifications
- Public API
- ActivityPub / Federation
- Native Application

---

# 62. Success Criteria

ReNovelが成功している状態を以下とする。

### Reader

ユーザーが、

```text
発見
↓
作品ページ
↓
Episode 1
↓
続きを読む
↓
Library / Follow
```

まで自然に到達できる。

### Author

作者が、

```text
作品作成
↓
執筆
↓
公開
↓
読者獲得
↓
Analytics確認
↓
作品改善
```

というサイクルをReNovel内で完結できる。

### Collaboration

ユーザーが、

```text
作品作成
↓
Collaborator招待
↓
共同執筆
↓
Revision確認
↓
公開
```

できる。

---

# 63. Product Identity

ReNovelは、

**「投稿できる場所」**

だけではなく、

**「書き、公開し、読まれ方を知り、他者と作品を作れる場所」**

を目指す。

読者にはシンプルな小説投稿サイトとして見え、

作者には強力な制作・分析プラットフォームとして機能することを最終的なプロダクト像とする。
