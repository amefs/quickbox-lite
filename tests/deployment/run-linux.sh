#!/usr/bin/env bash
set -euo pipefail
repo=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
baseline=${QUICKBOX_TEST_BASELINE:-e0b522b8ccced7a07d0ae9cb575c052af6054d7e}
context=$(mktemp -d)
trap 'rm -rf "$context"' EXIT
mkdir -p "$context/baseline"
git -C "$repo" archive "$baseline" setup/dashboard setup/templates | tar -xf - -C "$context/baseline"
printf 'Deployment baseline: %s\n' "$baseline"
if [[ "${QUICKBOX_DEPLOYMENT_SKIP_BUILD:-0}" != 1 ]]; then
  docker build --build-context "baseline=$context/baseline" -f "$repo/tests/deployment/Dockerfile" \
    -t quickbox-deployment-test "$repo"
fi
if [[ "${1:-}" == --build-only ]]; then exit 0; fi
runtime=()
if [[ "${QUICKBOX_DEPLOYMENT_SKIP_BUILD:-0}" == 1 ]]; then
  runtime=(-v "$repo:/input:ro" -v "$context/baseline:/baseline-input:ro")
  set -- bash /input/tests/deployment/container-entry.sh "$@"
fi
docker run --rm --init "${runtime[@]}" --cap-drop=ALL --cap-add=CHOWN --cap-add=DAC_OVERRIDE \
  --cap-add=FOWNER --cap-add=SETGID --cap-add=SETUID --cap-add=KILL --cap-add=AUDIT_WRITE \
  quickbox-deployment-test "$@"
