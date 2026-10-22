#!/usr/bin/env bash
set -euo pipefail
repo=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
export QUICKBOX_AUTH_FIXTURES
QUICKBOX_AUTH_FIXTURES=$(mktemp -d)
chmod 0755 "$QUICKBOX_AUTH_FIXTURES"
project="quickbox-auth-$$"
compose="$repo/tests/deployment/auth-compose.yml"
cleanup() {
  result=$?
  trap - EXIT
  if [[ $result -ne 0 ]]; then docker compose -p "$project" -f "$compose" logs --tail=100 || true; fi
  docker compose -p "$project" -f "$compose" down --remove-orphans || result=1
  if [[ -n "${QUICKBOX_AUTH_ARTIFACTS:-}" ]]; then
    mkdir -p "$QUICKBOX_AUTH_ARTIFACTS"
    find "$QUICKBOX_AUTH_FIXTURES" -maxdepth 1 -name '*-failure.png' -exec cp {} "$QUICKBOX_AUTH_ARTIFACTS/" \;
  fi
  # Provider storage may be root-owned on Linux; use the disposable container.
  if docker image inspect quickbox-deployment-test >/dev/null 2>&1; then
    docker run --rm -v "$QUICKBOX_AUTH_FIXTURES:/cleanup" quickbox-deployment-test \
      sh -c 'rm -rf /cleanup/*' || result=1
  else
    rm -rf "$QUICKBOX_AUTH_FIXTURES" || result=1
  fi
  if [[ -d "$QUICKBOX_AUTH_FIXTURES" ]]; then rmdir "$QUICKBOX_AUTH_FIXTURES" || result=1; fi
  exit "$result"
}
trap cleanup EXIT
if [[ "${QUICKBOX_AUTH_SKIP_BUILD:-0}" != 1 ]]; then
  bash "$repo/tests/deployment/run-linux.sh" --build-only
fi
python3 "$repo/tests/deployment/prepare-auth.py" "$QUICKBOX_AUTH_FIXTURES"
docker compose -p "$project" -f "$compose" up -d
node "$repo/e2e/scripts/deployment-auth.cjs"
