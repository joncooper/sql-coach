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

echo "==> Installing JS dependencies..."
bun install

echo ""
echo "Setup complete! Run 'bun run dev' to start the dev server."
