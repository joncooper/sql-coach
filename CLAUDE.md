# SQL Coach

Interactive SQL coaching tool for practicing SQL interview problems. LeetCode-style split-pane UI with PostgreSQL backend.

## Setup

```bash
# Start Postgres, install dbt + JS deps, seed database
./scripts/setup.sh

# Start dev server
bun run dev
# Open http://localhost:3000
```

## Architecture

- **Viewport**: Desktop only — mobile and tablet are intentionally unsupported
- **Frontend**: Next.js 16 (App Router) + TypeScript + Tailwind CSS
- **Editor**: CodeMirror 6 with PostgreSQL dialect
- **Database**: PostgreSQL 17 Alpine (Docker)
- **Data**: dbt-core + dbt-postgres for seeds/schema management
- **Layout**: react-resizable-panels (v4.9 — exports `Group`, `Panel`, `Separator`)
- **Dev compiler**: webpack (`next dev --webpack`). Next 16's default Turbopack dev runtime has a known async-hook Map overflow (`RangeError: Map maximum size exceeded` in `app-page-turbo.runtime.dev.js`) plus intermittent `components.ComponentMod.handler is not a function` 500s on route handlers. Webpack dev is slower on HMR but stable. Flip back via the `dev` script in `package.json` once Vercel ships a patch.

## Home Page — Two Modes

The home page (`src/app/page.tsx`) has two modes selected via `?mode=coach|catalog` (default: coach):

- **Coach mode** — one-screen daily practice ritual. The AI picks the next problem and explains why via an expandable "Why I picked this" panel. Inline mastery ring, due-for-review count, This Week activity chart, Continue working + Starred cards.
- **Catalog mode** — dense, sortable problem table with a left skill-tree sidebar and a right-rail Today's Focus card. For self-directed browsing.

Both modes share the same chrome (top nav with Coach/Catalog segmented toggle in `src/components/home/TopNav.tsx`) and the same visual language, documented in `DESIGN.md`.

## Coach Engine

`src/lib/coach.ts` is the brain behind Coach mode. Pure functions over a `StatsStore` + `ProblemSummary[]`, no I/O, fully tested (see `src/lib/coach.test.ts`). It exposes:

- `computeCategoryMastery(store, problems, clock)` — per-category score 0–1, unlock state (prerequisite-gated), in-progress flag. Sorted by skill-tree tier.
- `getReviewQueue(store, clock)` — overdue review items, oldest-first.
- `pickNextProblem(store, problems, clock)` — the full `CoachPick`: winning problem, teaser, bullet reasoning, mastery per category, candidate pool (chosen + a few notable rejects), learning path, review-due count, overall mastery %. Ranking priorities, highest first:
  1. Review-due items always win.
  2. Weakest unlocked category reinforcement.
  3. Current in-progress category momentum.
  4. Any unlocked category (forward progress).
  Penalized: recently attempted (last 1 day), solution viewed, already mastered. Score weights live at the top of `coach.ts` as `SCORE`.

The engine is also exposed at `POST /api/coach/next` (request body: `{ "store": StatsStore }`). The home page calls `pickNextProblem` directly on the client since stats live in localStorage — the API route is there for future SSR, external agents, or debugging (`curl -X POST ... | jq`).

## Design System

`DESIGN.md` at the repo root is the source of truth for palette, typography, and component vocabulary. All tokens live in `src/app/globals.css` as CSS custom properties. **When adding UI, read `DESIGN.md` first.** Do not reintroduce the old parchment/teal colors.

## Key Directories

- `problems/` — YAML problem definitions (30 problems)
- `dbt/` — dbt project (seeds in `dbt/seeds/{hr,ecommerce,analytics}/`)
- `src/app/` — Next.js pages and API routes
- `src/components/` — React components (SqlEditor, ResultsTable, etc.)
- `src/lib/` — Server utilities (db.ts, problems.ts, compare.ts)
- `scripts/` — setup.sh, reset-db.sh, init-roles.sql

## Database

- **coach_admin** role: full access (used by dbt and solution queries)
- **coach_readonly** role: SELECT only, 5s timeout (used for user queries)
- **Schemas**: hr, ecommerce, analytics (routed via dbt seed config)
- dbt manages all data; no standalone models, just seeds with schema routing
- `dbt/macros/generate_schema_name.sql` overrides default to get clean schema names

## Adding a New Problem

1. Create `problems/NNN-slug-name.yml` following existing format
2. Ensure referenced tables exist in seed data
3. Test solution SQL: `docker exec sql-coach-db psql -U coach_admin -d sql_coach -c "YOUR SQL"`
4. Restart dev server to pick up new problem

## Tooling — Non-Negotiable

- **bun** for ALL JavaScript/TypeScript operations — running scripts, installing packages, executing tests. Never use npm, yarn, pnpm, npx, or node directly.
- **uv** for ALL Python operations — installing packages, running scripts, managing virtualenvs. Never use pip, pip3, python -m pip, or bare python/python3 to install or run.
- **jq** for ALL JSON inspection and transformation. Never use inline Python scripts, node -e, or other interpreters to parse or query JSON.

These are hard requirements, not suggestions. If a command example elsewhere in this file or in any script uses the wrong tool, fix the script — don't follow it.

## Commands

- `bun run dev` — development server
- `bun run build` — production build
- `./scripts/reset-db.sh` — destroy and rebuild database
- `cd dbt && .venv/bin/dbt seed` — reload seed data
- `cd dbt && .venv/bin/dbt test` — run data quality tests

## Skill routing

When the user's request matches an available skill, ALWAYS invoke it using the Skill
tool as your FIRST action. Do NOT answer directly, do NOT use other tools first.
The skill has specialized workflows that produce better results than ad-hoc answers.

Key routing rules:
- Product ideas, "is this worth building", brainstorming → invoke office-hours
- Bugs, errors, "why is this broken", 500 errors → invoke investigate
- Ship, deploy, push, create PR → invoke ship
- QA, test the site, find bugs → invoke qa
- Code review, check my diff → invoke review
- Update docs after shipping → invoke document-release
- Weekly retro → invoke retro
- Design system, brand → invoke design-consultation
- Visual audit, design polish → invoke design-review
- Architecture review → invoke plan-eng-review
- Save progress, checkpoint, resume → invoke checkpoint
- Code quality, health check → invoke health
