#!/usr/bin/env bash
set -euo pipefail
repo=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
image=quickbox-deployment-test

case "${1:-}" in
--phase)
  : "${QUICKBOX_DEPLOYMENT_CONTAINER:?Set a container name for staged acceptance}"
  exec docker exec "$QUICKBOX_DEPLOYMENT_CONTAINER" python3 tests/deployment/run.py --phase "${2:?Supply a phase}"
  ;;
--cleanup)
  : "${QUICKBOX_DEPLOYMENT_CONTAINER:?Set a container name for staged acceptance}"
  if docker container inspect "$QUICKBOX_DEPLOYMENT_CONTAINER" >/dev/null 2>&1; then
    result=0
    docker exec "$QUICKBOX_DEPLOYMENT_CONTAINER" python3 tests/deployment/run.py --phase cleanup || result=1
    docker logs "$QUICKBOX_DEPLOYMENT_CONTAINER" || result=1
    docker rm -f "$QUICKBOX_DEPLOYMENT_CONTAINER" || result=1
    exit "$result"
  fi
  exit 0
  ;;
esac

baseline=${QUICKBOX_TEST_BASELINE:-e0b522b8ccced7a07d0ae9cb575c052af6054d7e}
context=$(mktemp -d)
trap 'rm -rf "$context"' EXIT
mkdir -p "$context/baseline"
git -C "$repo" archive "$baseline" setup/dashboard setup/templates | tar -xf - -C "$context/baseline"
printf 'Deployment baseline: %s\n' "$baseline"
if [[ "${QUICKBOX_DEPLOYMENT_SKIP_BUILD:-0}" != 1 && "${QUICKBOX_DEPLOYMENT_USE_IMAGE:-0}" != 1 ]]; then
  docker build --build-context "baseline=$context/baseline" -f "$repo/tests/deployment/Dockerfile" \
    -t "$image" "$repo"
fi
if [[ "${1:-}" == --build-only ]]; then exit 0; fi
runtime=()
if [[ "${QUICKBOX_DEPLOYMENT_SKIP_BUILD:-0}" == 1 ]]; then
  runtime=(-v "$repo:/input:ro" -v "$context/baseline:/baseline-input:ro")
fi
isolation=(--init --network=none --hostname=quickbox-acceptance --add-host=quickbox-acceptance:127.0.0.1
  --cap-drop=ALL --cap-add=CHOWN --cap-add=DAC_OVERRIDE
  --cap-add=FOWNER --cap-add=SETGID --cap-add=SETUID --cap-add=KILL --cap-add=AUDIT_WRITE)
if [[ "${1:-}" == --start ]]; then
  : "${QUICKBOX_DEPLOYMENT_CONTAINER:?Set a container name for staged acceptance}"
  docker run -d --name "$QUICKBOX_DEPLOYMENT_CONTAINER" "${isolation[@]}" ${runtime[@]+"${runtime[@]}"} "$image" sleep infinity
  if [[ "${QUICKBOX_DEPLOYMENT_SKIP_BUILD:-0}" == 1 ]]; then
    if ! docker exec "$QUICKBOX_DEPLOYMENT_CONTAINER" bash /input/tests/deployment/container-entry.sh true; then
      docker rm -f "$QUICKBOX_DEPLOYMENT_CONTAINER"
      exit 1
    fi
  fi
  exit 0
fi
if [[ "${QUICKBOX_DEPLOYMENT_SKIP_BUILD:-0}" == 1 ]]; then
  set -- bash /input/tests/deployment/container-entry.sh python3 tests/deployment/run.py "$@"
else
  set -- python3 tests/deployment/run.py "$@"
fi
docker run --rm "${isolation[@]}" ${runtime[@]+"${runtime[@]}"} "$image" "$@"
