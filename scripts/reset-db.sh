#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

echo "==> Destroying database volume..."
docker compose down -v

echo "==> Rebuilding..."
./scripts/setup.sh
