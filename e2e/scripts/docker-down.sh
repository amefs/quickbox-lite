#!/bin/sh
set -eu

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
ROOT_DIR="$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$ROOT_DIR/.env.compose"

if [ -f "$ENV_FILE" ]; then
  docker compose --env-file "$ENV_FILE" down -v
else
  docker compose down -v
fi
