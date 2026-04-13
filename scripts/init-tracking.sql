-- Telemetry schema for tracking solver activity. Feeds future coaching tuning.
CREATE SCHEMA IF NOT EXISTS coaching;

CREATE TABLE IF NOT EXISTS coaching.problem_runs (
  id       BIGSERIAL PRIMARY KEY,
  slug     TEXT NOT NULL,
  sql      TEXT NOT NULL,
  ran_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  success  BOOLEAN NOT NULL,
  error    TEXT
);

CREATE INDEX IF NOT EXISTS problem_runs_slug_ran_at_idx
  ON coaching.problem_runs (slug, ran_at DESC);

CREATE TABLE IF NOT EXISTS coaching.problem_submissions (
  id              BIGSERIAL PRIMARY KEY,
  slug            TEXT NOT NULL,
  sql             TEXT NOT NULL,
  submitted_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  passed          BOOLEAN NOT NULL,
  execution_ms    INTEGER,
  error           TEXT,
  analysis        JSONB,
  analyzed_at     TIMESTAMPTZ,
  analysis_error  TEXT
);

CREATE INDEX IF NOT EXISTS problem_submissions_slug_idx
  ON coaching.problem_submissions (slug, submitted_at DESC);
