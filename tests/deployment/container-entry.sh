#!/usr/bin/env bash
# Refresh a previously built dependency image with the current read-only checkout.
# Dependency lock changes require a rebuild; never silently test stale packages.
set -euo pipefail
cmp /input/setup/dashboard/ws/package-lock.json /opt/quickbox-source/setup/dashboard/ws/package-lock.json || {
  echo 'Dashboard dependencies changed: rebuild the deployment image without QUICKBOX_DEPLOYMENT_SKIP_BUILD.' >&2
  exit 1
}
cmp /baseline-input/setup/dashboard/ws/package-lock.json /opt/quickbox-baseline/setup/dashboard/ws/package-lock.json || {
  echo 'Baseline dependencies changed: rebuild the deployment image.' >&2
  exit 1
}
rsync -a --delete --exclude=.git --exclude=node_modules --exclude=.env --exclude='.env.*' \
  --exclude=.workbuddy --exclude=playwright-report --exclude=test-results --exclude=__pycache__ \
  /input/ /opt/quickbox-source/
rsync -a --delete --exclude=node_modules /baseline-input/ /opt/quickbox-baseline/
cd /opt/quickbox-source/setup/dashboard/ws
npm run build
cd /opt/quickbox-source
if [[ $# -gt 0 ]]; then exec "$@"; fi
exec python3 tests/deployment/run.py
