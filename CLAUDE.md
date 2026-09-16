# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Status

ReNovel is a web-novel publishing platform (reader-first, with strong author analytics, native collaboration, and GitHub-Fork-style derivative works). **The repo is currently a scaffold** — `app/src/index.ts` is a Hono "Hello" stub and the intended architecture below does not yet exist in code. `PRD.md` (~1500 lines, Japanese) is the authoritative product and architecture spec. Implementation-level design lives in `docs/design/` (see [Design Documents](#design-documents-docsdesign) below) — and **`docs/design/foundation/data-model.md` is the source of truth for the DB schema**. Before building a feature, read both the relevant PRD section and the matching design doc(s). The runnable app lives entirely under `app/`.

## Design Documents (`docs/design/`)

Detailed, implementation-ready design per domain — refines PRD §41–59 into concrete decisions (schemas, permission matrices, route tables, algorithms). Each doc opens with a summary; index at `docs/README.md`, and `ROADMAP.md` links the relevant docs from each phase. Read the matching doc before implementing:

- **data-model.md** — canonical PostgreSQL schema / ERD / enums / indexes. The Drizzle schema and every other doc follow its table & column names. **Change it first when the data model changes.**
- **auth.md** — authN (session + OAuth) and authZ (Collaborator-role permission matrix, Visibility×Publication-Status access rules). Authorization is enforced server-side; Private/Draft return 404 to non-viewers, insufficient role returns 403.
- **routing.md** — URL/slug design (`/@{handle}/{novelSlug}`, `/studio/*`) and the full route table.
- **text-notation.md** — ruby/emphasis parser grammar + **XSS-safe order (HTML-escape → then tokenize)**; one shared `renderNovelText()` for SSR body and editor preview.
- **writing-revision.md** — Episode state machine, append-only revisions, autosave (optimistic-lock 409), scheduled publish.
- **reading.md** · **social-notification.md** · **discovery.md** (JP full-text search + ranking) · **analytics.md** · **collaboration-fork.md** · **moderation.md** — per-domain specs.
- **glossary.md** (ubiquitous language) · **testing.md** (test strategy). Cross-cutting: **architecture.md** · **frontend.md** · **infrastructure.md**.

## Commands

Runtime is **Bun** (not Node); prefer `bun` over `npm`/`node`. App commands run from `app/`:

```sh
bun install            # install deps
bun run dev            # build CSS once + dev server w/ hot reload → http://localhost:3000
bun run css            # build Tailwind → public/styles.css (dev auto-runs this; css:watch to watch)
bun test               # run tests (bun:test)
bun run lint           # Biome check (format + lint)
bun run format         # Biome format --write
bun run db:generate    # drizzle-kit: generate migration from schema
bun run db:migrate     # drizzle-kit: apply migrations
```

### Containers — use Podman, not Docker

Local dev containers run under **Podman** (`podman machine` must be running). The Compose files and Dockerfiles are OCI-standard and unchanged; only the CLI differs. Run from the repo root:

```sh
podman compose -f docker/docker-compose.dev.yml up --build   # web + postgres
```

`docker/setup.sh` bootstraps `.env`, deps, and CSS. Do not invoke `docker` — use `podman` / `podman compose`.

## Tech Stack (per PRD §40)

- **Runtime:** Bun · **Framework:** Hono (the app is Hono-centric; avoid pulling in an SPA framework)
- **SSR:** `hono/jsx` · **Client interactivity:** `hono/jsx/dom`, used *only* for genuinely interactive islands (editor autosave, reader settings, analytics graphs, notifications, search filters, realtime). Do not client-render whole pages.
- **DB:** PostgreSQL · **ORM:** Drizzle (`drizzle-orm/postgres-js`; config in `app/drizzle.config.ts`, schema barrel in `src/infrastructure/database/schema/`). The schema must follow `docs/design/foundation/data-model.md` (canonical table/column/enum names).
- **UI:** Kiwa UI (`app/src/kiwa-ui.json`), a shadcn-style component registry; components are added into `@/components`, styled with Tailwind v4 (`src/styles/globals.css`). Use the `cn()` helper in `src/lib/utils.ts` for class merging.
- **Lint/format:** Biome (`app/biome.json`). CSS files and generated dirs are excluded from Biome.
- **Infra:** Compose (run via **Podman**, see above), self-hosted, exposed via Cloudflare Tunnel (no direct port-forwarding). `docker/` holds `Dockerfile.dev`/`Dockerfile.prod` + `docker-compose.dev.yml`.

## Intended Architecture (PRD §41–52)

Pattern is **DDD + MVC + Service Layer** ("DDD + MVC + S"). When implementing, follow this layering rather than putting logic in route handlers:

```
Presentation (Hono controllers/routes, hono/jsx views, middleware)
      ↓ calls
Application (Application Services = use cases, DTOs, read-side queries)
      ↓ uses
Domain (entities, value objects, repository *interfaces*, domain services) — one folder per domain
      ↑ implemented by
Infrastructure (Drizzle schema + repository implementations, storage, external)
```

Key rules:
- **Controllers stay thin:** parse input, get auth context, call one Application Service, render response. No business logic.
- **Repository interfaces live in Domain/Application; Drizzle implementations live in Infrastructure.** Domain code must not import Hono `Context` or Drizzle.
- **Auth context** is attached to Hono context (`c.get("user")`, `c.get("session")`) and passed down — the domain layer never reads it directly.
- **Analytics is deliberately separated** from transactional data (`analytics_events` → aggregation → `analytics_daily`/`analytics_hourly`), so it can be split into its own service later. Analytics event ingestion must never block reading actions.

Planned domains (PRD §42): `identity, novel, writing, collaboration, fork, reading, social, discovery, analytics, notification, moderation`. Proposed `src/` tree is in PRD §46; the Novel domain example is §47; request-flow examples are §48–49.

## Domain Notes That Affect Implementation

- **Novel structure:** `Novel → (optional) Chapter → Episode`. Chapters are optional; short works are a Novel with one Episode.
- **Episodes are revision-tracked** (`Episode → EpisodeRevision[]`), never bare overwrites — preserve history and support restore (PRD §12).
- **Editor is plain-text, not Markdown.** Two custom notations must be supported (PRD §11): ruby `｜文章《ルビ》` → `<ruby>文章<rt>ルビ</rt></ruby>`, and emphasis (傍点) `《《文章》》`.
- **Visibility** (Public/Unlisted/Private) is orthogonal to **Publication Status** (Ongoing/Completed/Hiatus); "Draft" is a visibility state, not a status (PRD §8–9).
- **Authorization must be enforced server-side**, not just in the UI — especially Collaborator roles (Owner/Admin/Writer/Editor/Viewer, §13) and Private novels. Forked works cannot remove attribution to the original (§14–15).
- **Privacy:** author analytics are always aggregated; never expose per-user "who read what, when" reading histories (§58).

## Conventions

- Import alias: `@/*` → `src/*` (see `app/tsconfig.json`). Note `app/src/tsconfig.json` is the Kiwa-UI-scoped config where `@/*` → `./*`.
- TypeScript is `strict`; JSX is configured for `hono/jsx` (`jsxImportSource: "hono/jsx"`).
- Commit messages follow Conventional Commits with a Japanese subject, e.g. `feat(app): 初期テンプレートを追加`.
- **Do not add a `Co-Authored-By: Claude` trailer to commits, and do not add "Generated with Claude Code" / "🤖" credits to PR bodies.**
