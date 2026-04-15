# SQL Coach

A local SQL practice environment with an AI coach that runs on your machine.

100+ interview-style problems, a real PostgreSQL 17 database, and an [Ollama](https://ollama.com)-backed coach that picks the next problem for you, explains why, and hints toward answers without giving them away. Your data and your half-finished queries never leave the laptop.

![SQL Coach home — the Coach engine explaining why it picked this problem](docs/images/home.png)

## Why this exists

I wanted a way to *actually* get good at SQL — not memorize LeetCode answers, not pipe queries to a cloud service, not stare at a blank `SELECT`. The tools I could find were either toy in-memory engines, cloud-only, or "premium subscription to unlock hints."

SQL Coach is what I wanted instead: hand-authored problems, real Postgres, a coach that can read what I wrote and name what I'm missing, and everything running locally.

## The local AI coach

Coaching is the point of the project. It runs entirely through Ollama on your own machine — no API keys, no telemetry, no bill.

**Pick the next problem.** Open the app and the Coach engine has already chosen one. It looks at what you've solved, what you're weak at, what's in your review queue, and what categories are unlocked in the skill tree, then ranks candidates and explains the pick in plain English: *"Reinforces Basic SELECT, your weakest category. You're at 0% mastery here. Start with an easy problem in this category before pushing harder."* The full scoring pool is visible, so you can see what it considered and rejected.

**Nudge, don't solve.** Open the chat panel on any problem and ask for help. The system prompt is eval-harness scored to *never* emit the full solution — it escalates hints across attempts 1, 2, 3+, praises what you got right, and names the missing concept. You get the satisfaction of finishing the query yourself.

**Generate a fresh problem.** Hit `POST /api/llm/generate` with a topic and difficulty and the model produces a new problem end-to-end — description, schema, seed data, reference solution, expected output — validated against the live database before being handed back. When you run out of the 100+ hand-authored problems, you never run out of problems.

The coaching prompts and the problem generator live in `src/lib/prompts/` and are scored by the eval harness in `evals/` so regressions show up before they reach you.

## The rest of it

![Writing a query and checking it against the reference solution](docs/images/problem.png)

A three-pane editor: problem + schema on the left, CodeMirror 6 with Postgres autocomplete in the top right, results or an interactive diff on the bottom right. `⌘↵` runs your query, `⌘⇧↵` submits it for grading.

- **Real Postgres, not a toy.** Every query runs against `postgres:17-alpine` in Docker. Window functions, `LATERAL`, recursive CTEs, `GROUPING SETS`, `generate_series` — all of it works the way it works in production.
- **Safe by construction.** Your queries execute as a `coach_readonly` role with a 5-second statement timeout. Runaway joins can't wedge anything.
- **Mastery, not a checkbox.** Problems move through *attempted → solved → practiced → mastered*. Peeking at the solution costs you. Spaced repetition schedules problems for review. Daily streaks track whether you actually showed up.
- **Skill tree.** Problems are grouped into tracks — Fundamentals, Analytics, Logic & Transformation, Text & Dates, Applied — with prerequisites, so you can drill window functions without wading through fifty JOIN problems first.
- **dbt for data.** Seeds live in `dbt/seeds/{hr,ecommerce,analytics}/`. Adding a dataset is a YAML edit and a `dbt seed`, not a migration.

![The full catalog of 100+ problems](docs/images/problems-list.png)

## Getting started

You'll need [Docker](https://www.docker.com/), [Bun](https://bun.sh), and [uv](https://docs.astral.sh/uv/). [Ollama](https://ollama.com) is optional but strongly recommended — the coach and problem generator are the best parts.

```bash
git clone https://github.com/joncooper/sql-coach.git
cd sql-coach
./scripts/setup.sh
bun run dev
```

Open http://localhost:3000.

`setup.sh` brings up Postgres, installs dbt, seeds the database, creates the roles, and installs JS dependencies. It's idempotent — re-run it any time something looks off.

### Turning on the coach

```bash
brew install ollama
ollama serve &
ollama pull gemma3:latest   # or any chat model you like
```

The app talks to `http://localhost:11434` by default. Override with `OLLAMA_URL` and `OLLAMA_MODEL` if you've got a different setup.

When Ollama is reachable, the **Ask AI** panel on the problem page and the `POST /api/llm/generate` endpoint come alive.

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│  Next.js 16 (App Router) · React 19 · Tailwind 4          │
│  CodeMirror 6 · react-resizable-panels · react-markdown   │
└───────────────┬──────────────────────────────────────────┘
                │
        ┌───────┴────────┐
        │  API routes    │
        │  /api/query    │  run read-only SQL       (coach_readonly)
        │  /api/submit   │  diff vs. reference solution
        │  /api/schema   │  introspect tables / columns
        │  /api/problems │  list & load YAML problems
        │  /api/coach    │  Coach engine: pick the next problem
        │  /api/coaching │  stream hints from Ollama
        │  /api/llm/*    │  generate problems, health check
        └───────┬────────┘
                │
     ┌──────────┴──────────┐
     ▼                     ▼
┌─────────────┐   ┌──────────────────────┐
│ PostgreSQL  │   │ Ollama (local LLM)   │
│  17-alpine  │   │  coaching + gen      │
│             │   └──────────────────────┘
│ schemas:    │
│  hr         │   ┌──────────────────────┐
│  ecommerce  │◀──│ dbt seed / dbt test  │
│  analytics  │   └──────────────────────┘
└─────────────┘
```

### The Coach engine

`src/lib/coach.ts` is the ranking logic behind Coach mode. Pure functions over a stats store and the problem list — no I/O, fully unit-tested in `coach.test.ts`.

Ranking priorities, highest first:

1. Review-due items always win.
2. Weakest unlocked category, for reinforcement.
3. Current in-progress category, for momentum.
4. Any unlocked category, for forward progress.

Penalties apply to recently-attempted problems, problems where you've already peeked at the solution, and problems you've already mastered. Score weights live at the top of the file.

Exposed at `POST /api/coach/next` for anything that wants to pick the next problem from outside the app — external agents, scripts, `curl | jq`.

### Directory layout

- `problems/` — YAML problem definitions (100+)
- `dbt/` — dbt project with seeds under `dbt/seeds/{hr,ecommerce,analytics}/`
- `src/app/` — Next.js pages and API routes
- `src/components/` — React components (`SqlEditor`, `ResultsTable`, `CoachingChat`, `SchemaExplorer`, …)
- `src/lib/` — server utilities (`db.ts`, `problems.ts`, `compare.ts`, `ollama.ts`, `stats.ts`, `coach.ts`, `skill-tree.ts`)
- `src/lib/prompts/` — coaching and problem-generation prompts
- `evals/` — prompt eval harness (tasks, judges, traces)
- `scripts/` — `setup.sh`, `reset-db.sh`, `init-roles.sql`, `init-tracking.sql`

## Adding problems by hand

Drop a YAML file in `problems/`:

```yaml
slug: my-new-problem
title: "My New Problem"
difficulty: medium
category: window-functions
tags: [window, rank]
domain: hr
tables: [employees]
description: |
  Find the top-paid employee in each department.
hints:
  - "Think about ranking rows inside each department."
  - "ROW_NUMBER() OVER (PARTITION BY ... ORDER BY ...)"
  - "Filter where the rank equals 1."
order_matters: false
solution: |
  SELECT department_id, name, salary
  FROM (
    SELECT *, ROW_NUMBER() OVER (PARTITION BY department_id ORDER BY salary DESC) AS rn
    FROM employees
  ) ranked
  WHERE rn = 1;
expected_columns: [department_id, name, salary]
```

Restart the dev server to pick it up. If the problem references new tables, add seeds under `dbt/seeds/<domain>/` and re-run `cd dbt && .venv/bin/dbt seed`.

## Commands

| Command | What it does |
| --- | --- |
| `./scripts/setup.sh` | Full bootstrap (Postgres + dbt + seeds + deps) |
| `bun run dev` | Dev server at http://localhost:3000 |
| `bun run build` | Production build |
| `bun test` | Run the Coach engine test suite |
| `./scripts/reset-db.sh` | Destroy and rebuild the database |
| `cd dbt && .venv/bin/dbt seed` | Reload seed data |
| `cd dbt && .venv/bin/dbt test` | Run data quality tests |

## Conventions

**bun** for all JS/TS, **uv** for all Python, **jq** for all JSON. No `npm`/`yarn`/`pnpm`, no `pip`, no ad-hoc `node -e`.

**Desktop only.** The UI is tuned for a three-pane layout and a real keyboard. Mobile and tablet are intentionally unsupported.

## License

[MIT](LICENSE) © Jon Cooper
