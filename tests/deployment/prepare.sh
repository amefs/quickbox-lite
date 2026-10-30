#!/usr/bin/env bash
set -euo pipefail
: "${RUNNER_TEMP:?Run this preparation helper in the CI runner environment}"
repo=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
cd "$repo"

case "${1:-}" in
panel)
  npm ci --no-audit --no-fund --prefix setup/dashboard/ws
  npm ci --no-audit --no-fund --prefix e2e
  (cd e2e && npx --no-install playwright install --with-deps chromium)
  ;;
linux)
  docker load -i "$RUNNER_TEMP/deployment-image.tar.gz"
  bash tests/deployment/run-linux.sh --start
  ;;
systemd)
  sudo apt-get update
  sudo apt-get install -y nginx sudo openssl rsync curl python3 procps util-linux iproute2
  sudo ln -sf "$(command -v node)" /usr/bin/node
  : "${npm_config_cache:?Set the shared offline cache path}"
  mkdir -p "$(dirname "$npm_config_cache")"
  tar -xzf "$RUNNER_TEMP/systemd-inputs.tar.gz" -C "$(dirname "$npm_config_cache")"
  npm ci --offline --no-audit --no-fund --prefix tests/deployment
  rm -rf setup/dashboard/ws/dist
  cp -a "$(dirname "$npm_config_cache")/dist" setup/dashboard/ws/dist
  ;;
authentication)
  docker load -i "$RUNNER_TEMP/deployment-image.tar.gz"
  npm ci --no-audit --no-fund --prefix e2e
  (cd e2e && npx --no-install playwright install --with-deps chromium webkit)
  bash tests/deployment/run-auth.sh --prepare
  ;;
*) echo 'Supply an environment: panel, linux, systemd or authentication.' >&2; exit 2 ;;
esac
