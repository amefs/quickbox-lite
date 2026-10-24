#!/usr/bin/env bash
set -euo pipefail
repo=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
compose="$repo/tests/deployment/auth-compose.yml"

prepare() {
  mkdir -p "$QUICKBOX_AUTH_FIXTURES"
  if [[ -n $(find "$QUICKBOX_AUTH_FIXTURES" -mindepth 1 -maxdepth 1 -print -quit) ]]; then
    echo 'Authentication fixture directory must be empty.' >&2
    return 1
  fi
  chmod 0755 "$QUICKBOX_AUTH_FIXTURES"
  touch "$QUICKBOX_AUTH_FIXTURES/.quickbox-auth-fixture"
  if [[ "${QUICKBOX_AUTH_SKIP_BUILD:-0}" != 1 ]]; then
    bash "$repo/tests/deployment/run-linux.sh" --build-only
  fi
  docker compose -p "$QUICKBOX_AUTH_PROJECT" -f "$compose" pull authelia vouch
  python3 "$repo/tests/deployment/prepare-auth.py" "$QUICKBOX_AUTH_FIXTURES"
  docker compose -p "$QUICKBOX_AUTH_PROJECT" -f "$compose" up -d --pull never
}

cleanup() {
  local result=0
  if [[ ! -f "$QUICKBOX_AUTH_FIXTURES/.quickbox-auth-fixture" ]]; then return 0; fi
  if [[ -n "${QUICKBOX_AUTH_ARTIFACTS:-}" ]]; then
    mkdir -p "$QUICKBOX_AUTH_ARTIFACTS"
    docker compose -p "$QUICKBOX_AUTH_PROJECT" -f "$compose" logs --no-color >"$QUICKBOX_AUTH_ARTIFACTS/compose.log" 2>&1 || result=1
    if [[ -f "$QUICKBOX_AUTH_FIXTURES/browser-access.log" ]]; then
      cp "$QUICKBOX_AUTH_FIXTURES/browser-access.log" "$QUICKBOX_AUTH_ARTIFACTS/" || result=1
    fi
    find "$QUICKBOX_AUTH_FIXTURES" -maxdepth 1 -name '*-failure.png' -exec cp {} "$QUICKBOX_AUTH_ARTIFACTS/" \;
  else
    docker compose -p "$QUICKBOX_AUTH_PROJECT" -f "$compose" logs --tail=100 || result=1
  fi
  docker compose -p "$QUICKBOX_AUTH_PROJECT" -f "$compose" down --remove-orphans || result=1
  if docker image inspect quickbox-deployment-test >/dev/null 2>&1; then
    docker run --rm --network=none -v "$QUICKBOX_AUTH_FIXTURES:/cleanup" quickbox-deployment-test \
      find /cleanup -mindepth 1 -delete || result=1
  else
    rm -rf "${QUICKBOX_AUTH_FIXTURES:?}"/* "$QUICKBOX_AUTH_FIXTURES/.quickbox-auth-fixture" || result=1
  fi
  rmdir "$QUICKBOX_AUTH_FIXTURES" || result=1
  return "$result"
}

if [[ $# -gt 0 ]]; then
  : "${QUICKBOX_AUTH_FIXTURES:?Set a fixture directory for staged authentication acceptance}"
  : "${QUICKBOX_AUTH_PROJECT:?Set a Compose project for staged authentication acceptance}"
  export QUICKBOX_AUTH_FIXTURES QUICKBOX_AUTH_PROJECT
  case "$1" in
  --prepare) prepare ;;
  --provider)
    case "${2:-}" in
    basic | authelia | vouch) QUICKBOX_AUTH_PROVIDER="$2" node "$repo/e2e/scripts/deployment-auth.cjs" ;;
    *) echo 'Supply a provider: basic, authelia or vouch.' >&2; exit 2 ;;
    esac
    ;;
  --cleanup) cleanup ;;
  *) echo 'Unknown authentication acceptance option.' >&2; exit 2 ;;
  esac
else
  QUICKBOX_AUTH_FIXTURES=$(mktemp -d)
  QUICKBOX_AUTH_PROJECT="quickbox-auth-$$"
  export QUICKBOX_AUTH_FIXTURES QUICKBOX_AUTH_PROJECT
  trap 'result=$?; trap - EXIT; cleanup || result=1; exit "$result"' EXIT
  prepare
  node "$repo/e2e/scripts/deployment-auth.cjs"
fi
