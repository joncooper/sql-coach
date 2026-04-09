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
