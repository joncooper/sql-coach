#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

echo "==> Starting PostgreSQL..."
docker compose up -d --wait

echo "==> Installing dbt dependencies..."
cd dbt
if [ ! -d .venv ]; then
  uv venv
fi
uv pip install dbt-core dbt-postgres

echo "==> Running dbt seed..."
.venv/bin/dbt seed

echo "==> Running dbt test..."
.venv/bin/dbt test
cd ..

echo "==> Granting readonly access to all schemas..."
docker exec sql-coach-db psql -U coach_admin -d sql_coach -c "
DO \$\$
DECLARE s TEXT;
BEGIN
  FOR s IN
    SELECT schema_name FROM information_schema.schemata
    WHERE schema_name NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
  LOOP
    EXECUTE format('GRANT USAGE ON SCHEMA %I TO coach_readonly', s);
    EXECUTE format('GRANT SELECT ON ALL TABLES IN SCHEMA %I TO coach_readonly', s);
  END LOOP;
END \$\$;
"

echo "==> Installing JS dependencies..."
bun install

echo ""
echo "Setup complete! Run 'bun run dev' to start the dev server."
