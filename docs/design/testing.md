# Testing Design / テスト戦略

> 対象: レイヤ別のテスト方針、フィクスチャ/ファクトリ、テスト DB 運用、CI 構成、カバレッジの考え方。
> 正典は PRD §55（Performance）, §59（Security）, §45（Layer Structure）。ツールは `bun:test`（`bun test`）と Biome（`biome check`）— CLAUDE.md の Commands 節を正とする。
> 認可判定の正典は [auth.md](./auth.md)、記法パーサの正典は [text-notation.md](./text-notation.md)、Revision の正典は [writing-revision.md](./writing-revision.md)、検索/ランキングの正典は [discovery.md](./discovery.md)、Analytics 非ブロッキング契約の正典は [analytics.md](./analytics.md)。本書はこれらを「どうテストするか」の観点でのみ扱い、仕様の再掲は最小限にする。
> 現状は scaffold（Phase 0）。`app/src/application/services/health.service.ts` + `health.service.test.ts` が唯一の実装済みテストで、本書が定める型（フェイク Repository による Application Service 単体テスト）を既になぞっている。本書はこのパターンを全ドメインへ拡張するための目標形。

## サマリー

- **テストピラミッドは DDD レイヤに沿って 5 段**: Domain 単体（最多・フェイク不要の純粋関数/クラス）→ Application Service 単体（Repository をフェイク/インメモリ化）→ Infrastructure Repository 統合（Podman の使い捨て Postgres に対して実行）→ Presentation 結合（Hono の `app.request()` でルート単位）→ E2E（主要フローのみ、最少数）。**上位レイヤほどテスト数は少なく、Domain 層に最も厚く投資する。**
- **高リスク領域は数値目標よりも網羅を優先する**: (1) 認可判定（[auth.md](./auth.md) の Role マトリクス・Visibility×Status マトリクス）、(2) 記法パーサの XSS/エッジケース（[text-notation.md](./text-notation.md) §8 のテーブルをそのままテストケースの基盤にする）、(3) Revision の非破壊性（append-only・復元が新規追記になること）、(4) 検索/ランキングのスコア式、(5) Analytics 収集の非ブロッキング性（読書操作をブロックしない・失敗を握りつぶす）。これらは各領域の担当ドキュメントのテーブルを1行=1テストケースへ機械的に落とし込む。
- **Application Service のテストは実 DB を使わずフェイク Repository で行う**のが既定（`health.service.test.ts` の型を継続）。Repository interface を満たすインメモリ実装（テストごとの状態を持つ単純なオブジェクト/クラス）をフィクスチャとして `test/fakes/` に集約する。
- **Infrastructure Repository の統合テストのみ実 Postgres を必要とし**、Podman で都度使い捨てコンテナを起動して migration を適用してから実行する。CI・ローカルとも同じ手順（`podman compose -f docker/docker-compose.test.yml`）を踏むことで環境差分を無くす。
- **CI は `bun test` と `biome check` を必須ゲートにし**、Infrastructure/Presentation/E2E テストは Postgres コンテナが必要なため別ジョブに分離する。カバレッジは数値目標（80%など）を掲げず、上記「高リスク領域」の網羅チェックリストをレビュー基準にする。

---

## 1. テストピラミッド全体像

```
                     ▲ 少数・遅い・実行コスト高
                     │
        E2E (主要フロー)              … ブラウザ/HTTPで通しの動作確認
                     │
   Presentation (Controller/Route)    … app.request() でルート単位の結合
                     │
 Infrastructure (Repository, 実DB)    … Podman 使い捨て Postgres
                     │
      Application Service (Use Case) … Repository はフェイク/インメモリ
                     │
         Domain (Entity/VO/Policy/記法パーサ)  … 純粋 unit、依存ゼロ
                     │
                     ▼ 多数・速い・実行コスト低
```

DDD のレイヤ図（[architecture.md](./architecture.md) §2）と対応させると、テスト戦略は「下のレイヤほど依存を持たないので厚くテストでき、上のレイヤほど依存を組み立てるコストが上がるので薄くする」という単純な原則に従う。

### 1.1 レイヤ別方針の一覧

| レイヤ | テスト対象の例 | 依存の扱い | 実行速度 | 分量の目安 |
|---|---|---|---|---|
| Domain | Value Object（`NovelTitle`, `CharCount` 等）、Policy（`CollaboratorPolicy`, `NovelAccessPolicy`）、記法パーサ（`shared/text-notation`）、Revision Diff Service | 一切モック不要（純粋関数/不変オブジェクト） | 最速（ms） | 最多 |
| Application Service | `PublishEpisodeService`, `SaveEpisodeDraftService`, `CreateNovelService` 等の Use Case | Repository interface を**フェイク実装**に差し替え | 速い | 多い |
| Infrastructure Repository | Drizzle 実装（`*.drizzle.ts`）が正しい SQL を発行し正しく写像するか | **実 Postgres**（Podman 使い捨て） | 中程度（DB 起動込み） | Repository の数だけ最低限 |
| Presentation | Controller/Route が正しい HTTP ステータス・ボディを返すか、認可ミドルウェアが機能するか | Application Service をモック、または DI コンテナごとテスト用に差し替え | 中程度 | Route ごとに主要系＋異常系 |
| E2E | ログイン→執筆→公開→閲覧、Fork、検索 等の主要ユーザーフロー | 実アプリを起動（DBも実体） | 遅い | 最少（フローの本数程度） |

### 1.2 各レイヤの責務境界（重複を避ける）

- **同じ振る舞いを複数レイヤで重複テストしない**。例えば「Viewer は Publish できない」という認可判定は Domain の `CollaboratorPolicy` 単体テストで**組み合わせ全パターン**を検証し、Application Service のテストでは「Policy が `false` を返したら `ForbiddenError` を投げる」という**配線**だけを 1〜2 ケース確認すれば足りる。Presentation では「`ForbiddenError` が 403 にマップされる」という**HTTPへの変換**だけを確認する。
- この分担により、Policy 変更時は Domain 層のテストだけを更新すれば良く、Application/Presentation のテストは「配線が繋がっているか」の少数ケースのまま安定する。

---

## 2. レイヤ別テスト方針の詳細

### 2.1 Domain 層（純粋 unit）

**対象**: Entity のドメインロジック（例: `Episode.publish()` の状態遷移検証）、Value Object（例: `Visibility`, `CollaboratorRole`, `CharCount`）、Policy（`CollaboratorPolicy.can()`, `NovelAccessPolicy.canView()`）、記法パーサ（`shared/text-notation`）、Revision Diff（`domain/writing/services/revision-diff-service.ts`）。

**方針**:
- 依存を一切持たない（Hono `Context` も Drizzle も import しない、[architecture.md](./architecture.md) §2 の制約そのものがテスト容易性の根拠）。よって `describe`/`it` に `beforeEach` でのセットアップすら基本的に不要。
- **境界値・異常系を網羅する**。Policy は「全 Role × 全 Action の組み合わせ表」をそのままテストマトリクスにする（§3.1）。
- 記法パーサは [text-notation.md](./text-notation.md) §8 の 22 ケースのテーブルを**そのまま `it.each` 相当（`for` ループ + `it`）でテストへ機械変換**する。将来テーブルに行が増えたら、テストもその行を追加するだけで済む構造にする。

```ts
// domain/collaboration/services/collaborator-policy.test.ts（スケッチ）
import { describe, expect, it } from 'bun:test'
import { can, type CollaboratorRole, type CollaborationAction } from './collaborator-policy'

const ROLES: (CollaboratorRole | null)[] = ['owner', 'admin', 'writer', 'editor', 'viewer', null]
const ACTIONS: CollaborationAction[] = [
  'novel.delete', 'novel.settings.update', 'novel.fork_policy.update',
  'collaborator.manage', 'episode.create', 'episode.edit',
  'episode.publish', 'revision.restore', 'proposal.decide', 'view.private',
]

// auth.md §3.1 のマトリクス表を定数として持ち込み、期待値の唯一の情報源にする
const EXPECTED: Record<CollaborationAction, (CollaboratorRole | null)[]> = {
  'novel.delete': ['owner'],
  'novel.fork_policy.update': ['owner'],
  'novel.settings.update': ['owner', 'admin'],
  'collaborator.manage': ['owner', 'admin'],
  'episode.create': ['owner', 'admin', 'writer'],
  'episode.edit': ['owner', 'admin', 'writer', 'editor'],
  'episode.publish': ['owner', 'admin'],
  'revision.restore': ['owner', 'admin', 'writer'],
  'proposal.decide': ['owner', 'admin'],
  'view.private': ['owner', 'admin', 'writer', 'editor', 'viewer'],
}

describe('CollaboratorPolicy.can — 全Role×全Action マトリクス', () => {
  for (const action of ACTIONS) {
    for (const role of ROLES) {
      const expected = EXPECTED[action].includes(role as CollaboratorRole)
      it(`${action} / role=${role ?? 'none'} → ${expected}`, () => {
        expect(can(role, action)).toBe(expected)
      })
    }
  }
})
```

- **決定 / 理由 / 代替案**: マトリクスを「期待値テーブル定数 + 二重ループ」で表現する方式を採用する。理由は auth.md の表を実装（`MATRIX`）とテスト（`EXPECTED`）の**2箇所に手で転記**することで、実装だけ変更してテストを更新し忘れる事故（サイレントな権限緩和）を防ぎやすくするため（2つの独立した定義が一致することを機械的に検証する形）。代替案として「実装の `MATRIX` を直接 import してテストする」は、実装を変更すればテストが自動で追従してしまい**権限マトリクス変更の検知力を失う**ため不採用。Policy 定義を変更する PR では、auth.md の表・実装の `MATRIX`・テストの `EXPECTED` の**3箇所を同時に更新する**運用ルールとする（レビューチェックリスト化、§6）。

### 2.2 Application Service 層

**対象**: `application/services/*`（コマンド系 Use Case）、`application/queries/*`（読み取り専用）。

**方針**:
- Repository は**フェイク実装**（インメモリ）に差し替える。モックライブラリの `mock()`/spy は最小限にし、基本は「配列を内部に持つだけの素朴なクラス/オブジェクト」を使う（`health.service.test.ts` の `fakeRepo` パターンを踏襲）。
- フェイクは Repository interface（Domain/Application 側で定義）を満たすことをコンパイル時に強制する。実装が変わって interface が変われば、フェイクも型エラーで検知される。
- **1 Use Case = 主要系1〜数ケース + 権限エラー配線1ケース + Not Found配線1ケース**程度に絞る（権限判定の全網羅は Domain 側で済んでいるため、Application 側では「Policy の結果に応じて正しい Error を投げるか」の配線確認のみ）。
- 副作用（Repository への保存呼び出し）はフェイクが記録した呼び出し履歴（例: `saved` 配列）を検証することで確認する。

```ts
// application/services/publish-episode-service.test.ts（スケッチ）
import { describe, expect, it } from 'bun:test'
import { PublishEpisodeService } from './publish-episode-service'
import { ForbiddenError, NotFoundError } from '@/shared/errors'

function fakeCollaborators(role: string | null) {
  return { findRole: async () => role }
}
function fakeEpisodes(episode: { id: string; novelId: string; publish: () => void } | null) {
  const saved: unknown[] = []
  return {
    findById: async () => episode,
    save: async (e: unknown) => { saved.push(e) },
    saved,
  }
}

describe('PublishEpisodeService', () => {
  it('Owner は Episode を公開できる', async () => {
    let published = false
    const episode = { id: 'ep1', novelId: 'n1', publish: () => { published = true } }
    const episodes = fakeEpisodes(episode)
    const service = new PublishEpisodeService(episodes as never, fakeCollaborators('owner') as never)
    await service.execute({ actorUserId: 'u1', novelId: 'n1', episodeId: 'ep1' })
    expect(published).toBe(true)
    expect(episodes.saved).toHaveLength(1)
  })

  it('Viewer は ForbiddenError（配線確認のみ、全Role網羅はPolicy側でテスト済み）', async () => {
    const service = new PublishEpisodeService(fakeEpisodes(null) as never, fakeCollaborators('viewer') as never)
    await expect(service.execute({ actorUserId: 'u1', novelId: 'n1', episodeId: 'ep1' }))
      .rejects.toThrow(ForbiddenError)
  })

  it('存在しない Episode は NotFoundError', async () => {
    const service = new PublishEpisodeService(fakeEpisodes(null) as never, fakeCollaborators('owner') as never)
    await expect(service.execute({ actorUserId: 'u1', novelId: 'n1', episodeId: 'missing' }))
      .rejects.toThrow(NotFoundError)
  })
})
```

- **フィクスチャ配置**: 汎用的に使い回すフェイク Repository は `app/src/test/fakes/<domain>/`（例: `test/fakes/collaboration/fake-collaborator-repository.ts`）に集約し、テストファイルごとの重複実装を避ける。Use Case 固有の一時的なフェイクはテストファイル内にインラインで定義してよい（早すぎる抽象化を避ける）。

### 2.3 Infrastructure Repository 層（統合テスト）

**対象**: `infrastructure/database/repositories/*.drizzle.ts`。Drizzle が生成する SQL・型マッピング・制約（UNIQUE/CHECK/外部キー）が仕様通りに機能するか。

**方針**:
- **実 Postgres が必要**。フェイクでは UNIQUE 制約違反や CHECK 制約、Drizzle のクエリビルダのバグを検出できないため、このレイヤだけは実 DB に対して検証する。
- **Podman ベースの使い捨て DB**（testcontainers 相当をコンテナランタイム＝Podman で実現）。[infrastructure.md](./infrastructure.md) の方針（`docker/` 配下は名称のみ Docker、実行は Podman）を踏襲し、専用の `docker/docker-compose.test.yml` を用意する。

```yaml
# docker/docker-compose.test.yml（案）
services:
  postgres-test:
    image: postgres:16
    environment:
      POSTGRES_DB: renovel_test
      POSTGRES_USER: renovel
      POSTGRES_PASSWORD: renovel
    ports:
      - "55432:5432"
    tmpfs:
      - /var/lib/postgresql/data   # ディスク永続化しない使い捨てDB
```

- **実行手順**（ローカル/CI 共通）:
  1. `podman compose -f docker/docker-compose.test.yml up -d`
  2. `DATABASE_URL=postgres://renovel:renovel@localhost:55432/renovel_test bun run db:migrate`（drizzle-kit migrate をテスト DB に適用）
  3. `bun test src/infrastructure` （Infrastructure 配下のみ実行するタグ/パス分離、§4）
  4. `podman compose -f docker/docker-compose.test.yml down -v`（コンテナ・ボリュームごと破棄）
- **テスト間の分離**: 各テストファイル（または `describe` 単位）は、使用するテーブルに対して**トランザクションを開始し `ROLLBACK` で後始末**するか、テスト前後で対象テーブルを `TRUNCATE ... CASCADE` する。Bun 標準の `beforeEach`/`afterEach` にフックする。**決定**: トランザクション+ROLLBACK 方式を第一候補とする（高速・並列実行に強い）。ただし Scheduled Publish の worker テストのように「別トランザクション/別コネクションからの可視性」を検証したいケース（PRD の冪等性要件、[writing-revision.md](./writing-revision.md) §4.3）は TRUNCATE 方式に切り替える（トランザクション内では別コネクションから中身が見えないため）。
- **何をテストするか**: 「保存して読み出したら同じ値が返る」という自明なラウンドトリップだけでなく、以下を優先する。
  - UNIQUE 制約（例: `collaborators` の Novel あたり `owner` 1 行のみ、`scheduled_publishes` の `UNIQUE(episode_id)`）が Repository 層で適切なドメインエラーにマップされること。
  - Soft Delete 対象テーブルで削除済み行がデフォルトクエリから除外されること。
  - N+1 の作り込み防止のため、一覧取得系 Repository メソッドは**発行クエリ数の期待値**を記録する（Drizzle のログフックでクエリ数をカウントし、`expect(queryCount).toBeLessThanOrEqual(N)` のようなガードを置く。PRD §55「N+1を発生させない」の回帰防止）。

### 2.4 Presentation 層（Controller/Route 結合テスト）

**対象**: `presentation/routes/*` + `presentation/controllers/*` + `presentation/middleware/*`。

**方針**:
- Hono アプリの `app.request(path, init)` を直接呼び出す結合テストとする（実サーバをポート起動しない、[Hono の標準テスト手法](https://hono.dev/)に準拠）。
- **Application Service はモック/フェイクに差し替える**（DI コンテナ、`presentation/container.ts` にテスト用の差し替えポイントを用意）。Presentation 層のテストは「HTTP リクエスト → 正しい Service が正しい引数で呼ばれ、Service の結果/例外が正しい HTTP レスポンスに変換されるか」に限定し、Use Case の中身は再テストしない。
- **必ずテストする横断的関心事**:
  - 認証必須ルートで未ログイン（`c.get("user") === null`）時に 401/リダイレクトになること（`requireAuth()` middleware、[auth.md](./auth.md) §4.2）。
  - `ForbiddenError`/`NotFoundError` が共通エラーハンドラで 403/404 に正しくマップされること（[auth.md](./auth.md) §4.3 の使い分け表を回帰テスト化）。
  - CSRF middleware: 許可 Origin 以外からの状態変更リクエストが 403 になること（[auth.md](./auth.md) §5）。
  - Rate Limit middleware: しきい値超過で 429 になること（[auth.md](./auth.md) §6 の主要経路のみ）。

```ts
// presentation/routes/episode.route.test.ts（スケッチ）
import { describe, expect, it } from 'bun:test'
import { createApp } from '@/presentation/app'

describe('POST /novels/:novelId/episodes/:episodeId/publish', () => {
  it('未ログインは401', async () => {
    const app = createApp({ /* テスト用DIコンテナ */ })
    const res = await app.request('/novels/n1/episodes/e1/publish', { method: 'POST' })
    expect(res.status).toBe(401)
  })

  it('Viewer 権限では403', async () => {
    const app = createApp({ /* 認証済みだが role=viewer を返すフェイク */ })
    const res = await app.request('/novels/n1/episodes/e1/publish', {
      method: 'POST',
      headers: { cookie: 'renovel_session=viewer-session' },
    })
    expect(res.status).toBe(403)
  })
})
```

### 2.5 E2E（主要フロー）

**対象**: 実アプリ（`bun run dev` 相当、または本番ビルド）+ 実 Postgres（Podman）を起動し、HTTP 経由（または Playwright 等のブラウザ自動化）で通しの動作を検証する。

**方針**:
- **本数を絞る**。候補フロー（1本ずつ、いずれも「読者/作者にとって致命的に壊れたら困る」導線）:
  1. サインアップ → ログイン → Novel 作成 → Episode 執筆（Autosave）→ Publish → Public 閲覧（ゲストで到達可能）。
  2. Private Novel を非 Collaborator が閲覧しようとして 404 になる（[auth.md](./auth.md) の中核契約の E2E 裏取り）。
  3. Fork（[collaboration-fork.md](./collaboration-fork.md)）→ 派生作品に原作の帰属表示が残る。
  4. 検索でキーワード一致する Public Novel が表示され、Private/Unlisted が表示されない（[discovery.md](./discovery.md)）。
  5. Episode 閲覧で Analytics イベントが送信されるが、送信の成否に関わらずページ表示・スクロール操作がブロックされない（[analytics.md](./analytics.md) の非ブロッキング契約、疑似ネットワーク遅延/失敗を注入して確認）。
- ブラウザ自動化ツール（Playwright 等）の採用可否・実行基盤は未決事項（§7）とし、1.0 初期は HTTP レベル（`fetch`/`app.request` を実サーバに対して行う）の E2E から始めてよい。

---

## 3. 高リスク領域ごとの網羅チェックリスト

以下は「テスト密度を数値目標ではなく網羅性で管理する」ための領域別チェックリスト。各領域のドキュメントの表・状態遷移図を**そのままテストケースの入力**にする。

### 3.1 認可判定（[auth.md](./auth.md)）

| チェック項目 | ソース | テスト配置 |
|---|---|---|
| Collaborator Role × Action の全組み合わせ | auth.md §3.1 表 | Domain: `collaborator-policy.test.ts`（§2.1） |
| Visibility × Publication Status × 閲覧者種別の到達可否 | auth.md §3.2 表 | Domain: `novel-access-policy.test.ts` |
| Episode 実効 Visibility の `min(novelVisibility, episodeVisibility)` 解決 | auth.md §3.2 末尾 | Domain: 単体 |
| 403/404 の使い分け | auth.md §4.3 表 | Presentation: ルートごとの結合テスト（§2.4） |
| `suspended`/`banned` のアクセス制御 | auth.md §4.4 表 | Application: `AuthorizationGuard` 単体 + Presentation 結合 |
| Private/Draft への非 Collaborator アクセスが 404（存在秘匿） | auth.md §4.3 | Presentation + E2E フロー2（§2.5） |

### 3.2 記法パーサ（[text-notation.md](./text-notation.md)）

- §8 の 22 テストケース表を**そのまま**移植する（1行=1 `it`）。XSS 系（表内 #10, #11, #12）は特に**必ず含める**——これらは他レイヤでは検出できない（Domain 層でしか純粋関数として再現できない）ため、記法パーサのテストが唯一の防衛線になる。
- 追加すべき性質テスト: `renderNovelText` の出力に**生の `<`/`>` がユーザー入力由来で残らない**ことを、ランダム化した入力（fuzz 的な文字列: 記法文字と HTML 特殊文字を混在させた生成データ）に対しても確認する（境界ケースの取りこぼし検出、実装コストと相談の上で優先度は中）。
- SSR と Editor Preview island が**同一関数を共有**していること自体は型/import のレベルで保証される設計（[text-notation.md](./text-notation.md) §7.3）なので、二重実装によるロジック乖離を検出するテストは不要（そもそも1実装しか存在しない）。

### 3.3 Revision の非破壊性・復元（[writing-revision.md](./writing-revision.md)）

| チェック項目 | 検証内容 |
|---|---|
| Append-only | `episode_revisions` に対する Repository が UPDATE/DELETE 相当のメソッドを公開していない（interface 自体に持たせない設計を型で強制。実行時テストは Infrastructure 層で「同一 `revision_no` の二重作成が UNIQUE 制約違反になる」ことを確認） |
| Autosave は Revision を作らない | Application: `SaveEpisodeDraftService` 実行後、フェイク Revision Repository への保存呼び出しが 0 回であることを確認 |
| 手動保存/Publish/Restore は Revision を作る | Application: 各 Service 実行後、フェイクへの保存呼び出しが 1 回であることを確認 |
| no-op 保存（内容不変）で Revision を増やさない | Application: 同一 `body` で連続保存 → 2回目は Revision 未作成（[writing-revision.md](./writing-revision.md) §2.2） |
| 復元は新規追記であり過去 Revision を書き換えない | Application: Restore 実行前後で対象より前の `revision_no` の内容が不変（フェイク Repository のスナップショット比較） |
| `revision_no` の連番・`UNIQUE(episode_id, revision_no)` | Infrastructure 統合テスト（実 Postgres で制約違反を確認） |
| Scheduled Publish の冪等性（二重公開防止） | Infrastructure 統合テスト: 複数「worker」相当の並行呼び出しをシミュレートし、`status='pending'` からの `UPDATE ... WHERE status='pending' RETURNING` が一方のみ成功することを確認（[writing-revision.md](./writing-revision.md) §4.3） |

### 3.4 検索/ランキングのスコア（[discovery.md](./discovery.md)）

- スコア式（§4.3 の `score_A`/`score_B` と合算）は Domain の純粋関数として実装し、**既知の入力に対する期待値を手計算で用意した固定ケース**でテストする（例: イベント無し→スコア0、単一 like 1件・経過0日→`w_like` に一致、半減期経過後→スコアが約半分）。浮動小数点比較は許容誤差（`toBeCloseTo` 相当）を使う。
- `ranking_snapshots` への冪等 upsert（`ON CONFLICT ... DO UPDATE`）は Infrastructure 統合テストで、同一 `(period, bucket_date, novel_id)` に対する再実行が行を増やさず値のみ更新することを確認する。
- 検索の Visibility フィルタ（Public のみ対象、[discovery.md](./discovery.md) の PGroonga クエリ）は「Private/Unlisted/Hidden な Novel がヒットしない」ケースを Infrastructure 統合テストに含める（認可漏れが検索経由で情報漏洩する事故を防ぐ、[auth.md](./auth.md) §3.2 と接続）。

### 3.5 Analytics の非ブロッキング性（[analytics.md](./analytics.md)）

- **同期処理でないことの確認**: `POST /api/analytics/events` の Controller/Application は、イベント保存が失敗（DB エラー・バリデーション失敗）しても例外を呼び出し元（読書ページのレンダリング/他リクエスト）に伝播させず、**常に `202` 相当を返す**ことを Presentation 結合テストで確認する（[analytics.md](./analytics.md) §「fire-and-forget」）。
- **CSRF 免除の意図的な例外**であることを回帰テストで明示する（他ルートはCSRF必須だが、このルートだけ Origin/Referer 検証のみで許可されることをテストし、「うっかり CSRF 必須化してしまう」将来の変更を検知できるようにする）。
- 冪等性: 同一イベントの重複配送（beacon の二重送信）が `analytics_events`（生ログ）には複数行残ってよいが、集計後の `analytics_daily` の unique 系指標が水増しされないことを Infrastructure/集計ロジックの統合テストで確認する（[analytics.md](./analytics.md) の distinct dedup 方針）。
- 読書操作をブロックしないという性質は**E2E フロー5**（§2.5）でも裏取りする（Analytics エンドポイントに人為的な遅延/失敗を注入し、ページ操作の応答性に影響がないことを確認）。

---

## 4. テストファイルの配置規約

- **コロケーション**を既定にする（`health.service.test.ts` の例に倣う）: テスト対象ファイルと同じディレクトリに `*.test.ts` を置く。Domain/Application は基本的にこの形。
- **Infrastructure の統合テストは実 DB を要求する**ため、通常の `bun test`（フェイクのみで完結するテスト）と**分離実行できるように配置/命名で区別する**。
  - 決定: ファイル名で区別する（`*.integration.test.ts`）。`bun test` はデフォルトで全 `*.test.ts` を拾うため、Infrastructure 用は `*.integration.test.ts` にし、`package.json` に以下のスクリプトを追加する。
    ```json
    {
      "scripts": {
        "test": "bun test --ignore='**/*.integration.test.ts'",
        "test:integration": "bun test '**/*.integration.test.ts'",
        "test:all": "bun test"
      }
    }
    ```
  - 理由: ディレクトリ（例: `src/infrastructure/**`）で区別する案も検討したが、Presentation 結合テストも DB こそ使わないもののフェイク DI が絡み実行時間が伸びやすく、「ディレクトリ＝実行コスト」の対応が崩れやすい。ファイル名サフィックスなら実行コストの高いテストをレイヤ横断で正確に分離でき、CI のジョブ分割（§5）とも素直に対応する。
- **E2E** は `app/e2e/`（新規ディレクトリ、`src/` の外）に配置し、通常の `bun test` 実行対象から除外する（起動オーバーヘッドが大きく、ローカル開発中のfeedback loopに含めたくないため）。

## 5. フィクスチャ / ファクトリ方針

- **フェイク Repository**: `app/src/test/fakes/<domain>/` に、Repository interface ごとに 1 ファイル。コンストラクタで初期データ（配列）を受け取り、`save`/`findById` 等の呼び出し履歴を公開プロパティとして持つ素朴な実装にする（外部モックライブラリへの依存を避け、型安全性を保つ）。
- **テストデータビルダー（Object Mother / Factory）**: Entity や DTO を「テストに必要な値だけ指定し、それ以外は妥当なデフォルト値で埋める」ビルダー関数を `app/src/test/factories/` に置く（例: `makeNovel({ visibility: 'private' })` は他の全フィールドにデフォルト値を補う）。理由: 各テストがドメインの全フィールドを毎回書き下すと、フィールド追加のたびに無関係な既存テストが壊れる（テストの意図と無関係な情報でテストが埋まる）。ビルダー方式ならフィールド追加時の影響をビルダー1箇所に閉じ込められる。
- **Infrastructure 統合テスト用のシードデータ**: 各テストファイルが自身の必要なデータを `beforeEach` 内で明示的に作る（グローバルな共有シードは避ける。テスト間の暗黙の順序依存を作らないため）。

## 6. Migration 適用と CI 実行

### 6.1 テスト DB への migration 適用

- テスト用 Postgres は**都度まっさらな状態から migration を適用**する（drizzle-kit の生成済みマイグレーションファイルを正とし、`db:push` のようなスキーマ直接同期はテストでも使わない — 本番と同じ経路で検証することで migration ファイル自体の不整合も検出できる）。
- ローカルでの手順は §2.3 参照。CI では同等の手順をジョブ内で自動化する。

### 6.2 CI 構成（案）

CI プラットフォームは未決（§7）だが、ジョブ構成の方針は以下で確定する。

| ジョブ | 内容 | 必要な外部リソース | 実行トリガ |
|---|---|---|---|
| `lint` | `bun run lint`（Biome check：format + lint） | なし | 全 push/PR |
| `test:unit` | `bun test`（Domain/Application/Presentation、フェイクのみ） | なし | 全 push/PR |
| `test:integration` | `bun run db:migrate` → `bun run test:integration`（Infrastructure） | Postgres コンテナ（CI ランナー上の Podman、または CI 側の Postgres service） | 全 push/PR（DB を要するがコストは許容範囲） |
| `test:e2e` | 主要フロー（§2.5） | Postgres + アプリ起動 | PR マージ前 or 主要ブランチのみ（実行コストが高いため頻度を下げる余地を残す） |

- **マージの必須条件**: `lint` + `test:unit` + `test:integration` を必須ゲートとする。`test:e2e` は当初は必須ゲートにせず、安定してから昇格させる（未決事項）。
- **Podman on CI**: ローカル開発と同じ Podman コマンド体系を CI でも使えるかは CI サービスの Podman サポート状況に依存する（GitHub Actions の場合 `containers:` 機能や `docker`互換ソケットの扱いに注意）。CI 環境で Podman が使えない場合のフォールバックとして、CI 専用に `docker-compose.test.yml` を素の Postgres service（CI プラットフォームのネイティブ Postgres service 機能）で代替する余地を残す。**いずれの場合も接続先は環境変数 `DATABASE_URL` に統一し、テストコード側は起動方法を意識しない。**

### 6.3 Biome との関係

- `bun run lint`（`biome check .`）は型チェック相当は行わない点に注意（Biome は formatter + linter であり、型チェックは別途 `tsc --noEmit` 相当が必要になる場合、CI ジョブに追加を検討。現状 `package.json` に型チェック専用スクリプトはなく、未決事項に送る）。
- テストコード自体も Biome の対象（`app/biome.json` の `includes` から `test/` 等が除外されていないか確認し、除外されていればテストコードの整形/lint 対象化を検討）。

---

## 7. カバレッジの考え方

- **数値目標（行カバレッジ○%等）を掲げない。** 理由: DDD レイヤの性質上、Presentation の薄い Controller（入力取得→Service呼び出し→レスポンス生成のみ）は行カバレッジを追っても得られる保証が薄く、逆に Domain の Policy/記法パーサのような「1行が重い」コードは行数以上にケース網羅が重要——単一の数値目標はどちらの実態も正しく表さない。
- 代わりに、**§3 の高リスク領域チェックリストの充足**をレビュー観点にする。PR で以下のドメインに変更が入った場合、対応するテスト更新の有無をレビューチェック項目にする:
  - 認可マトリクス変更 → auth.md の表 / 実装 `MATRIX` / テスト `EXPECTED` の3点セット更新（§2.1）
  - 記法パーサ変更 → text-notation.md §8 のテーブルへの行追加 + 対応テスト追加
  - Revision 関連の状態遷移変更 → writing-revision.md の状態遷移図更新 + §3.3 のチェックリスト再確認
  - スコア式変更 → discovery.md の式更新 + 固定ケースの期待値再計算
  - Analytics 収集経路変更 → 非ブロッキング性・CSRF免除の回帰テストの再確認
- 上記に該当しない一般的な CRUD 的機能（例: プロフィール編集フォーム）は、主要系1ケース+代表的な異常系1〜2ケース程度の軽量なテストで十分とし、過剰なテストで開発速度を落とさない。

---

## 8. 未決事項

1. **CI プラットフォームの選定**（GitHub Actions / self-hosted runner 等）と、その上での Podman 実行可否。[infrastructure.md](./infrastructure.md) の Self Hosted 方針と合わせて検討。
2. **型チェック（`tsc --noEmit`）を CI ゲートに含めるか**、含める場合の実行速度対策（incremental build 等）。
3. **E2E のツール選定**（Playwright 等のブラウザ自動化を導入するか、HTTP レベルの E2E に留めるか）。hono/jsx/dom island（Autosave, Reader Settings 等）の実ブラウザ挙動を検証したい場合はブラウザ自動化が望ましいが、導入コストとのトレードオフ。
4. **`test:e2e` を必須マージゲートに昇格するタイミング**。当初は任意実行とし、フレーキーさが解消してから昇格する想定だが、判断基準は未確定。
5. **記法パーサの fuzz テスト**（§3.2）を実際に導入するか、どの程度の入力空間・実行時間をかけるか。
6. **N+1 回帰防止のクエリ数カウント手法**（§2.3）: Drizzle のログフックから正確にクエリ数を取得する実装方法（`postgres-js` のクエリログ/イベントフックの調査）が未検証。
7. **フェイク Repository とモックライブラリの併用範囲**: 本書は「素朴な手書きフェイク」を既定にしたが、Presentation 層のような呼び出し検証中心のテストでは `bun:test` の `mock()`（spy）を使う場面も出てくる可能性があり、使い分けの明文化が必要。
8. **テストデータのランダム性（faker 系ライブラリ導入）の要否**: フィクスチャの「妥当なデフォルト値」を手書き固定文字列にするか、ランダム生成にして値のハードコード依存を防ぐかは未決。

---

## 関連ドキュメント

- [architecture.md](./architecture.md) — レイヤ構成・依存の向き（テスト容易性の設計根拠）
- [auth.md](./auth.md) — 認可マトリクス・403/404 使い分け（§3.1 のテスト網羅対象）
- [text-notation.md](./text-notation.md) — 記法パーサのテストケース表（§3.2 でそのまま移植）
- [writing-revision.md](./writing-revision.md) — Revision 状態遷移・Scheduled Publish 冪等性（§3.3）
- [discovery.md](./discovery.md) — スコア式・PGroonga 検索（§3.4）
- [analytics.md](./analytics.md) — fire-and-forget 契約（§3.5）
- [infrastructure.md](./infrastructure.md) — Podman Compose 構成（テスト用 Postgres の起動基盤）
