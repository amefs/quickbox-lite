#!/bin/sh
set -eu

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
ROOT_DIR="$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$ROOT_DIR/.env.compose"
LOCK_HASH="$(sha256sum "$ROOT_DIR/../setup/dashboard/ws/package-lock.json" | awk '{print $1}')"
SHORT_HASH="$(printf '%s' "$LOCK_HASH" | cut -c1-12)"
VOLUME_NAME="quickbox-e2e-ws-node-modules-$SHORT_HASH"

printf 'WS_NODE_MODULES_VOLUME=%s\n' "$VOLUME_NAME" > "$ENV_FILE"

docker compose --env-file "$ENV_FILE" up -d nginx
