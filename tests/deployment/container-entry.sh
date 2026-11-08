#!/usr/bin/env bash
set -euo pipefail
cmp /input/setup/dashboard/ws/package-lock.json /opt/quickbox-source/setup/dashboard/ws/package-lock.json || {
  echo 'Dashboard dependencies changed: rebuild the deployment image without QUICKBOX_DEPLOYMENT_SKIP_BUILD.' >&2
  exit 1
}
cmp /baseline-input/setup/dashboard/ws/package-lock.json /opt/quickbox-baseline/setup/dashboard/ws/package-lock.json || {
  echo 'Baseline dependencies changed: rebuild the deployment image.' >&2
  exit 1
}
client_dir=/opt/quickbox-source/tests/deployment
legacy_client_dir=/opt/quickbox-source/tests/system/deployment
if [[ ! -f "${client_dir}/package-lock.json" && -f "${legacy_client_dir}/package-lock.json" ]]; then
  client_dir="${legacy_client_dir}"
  mv "${client_dir}/node_modules" /tmp/quickbox-deployment-client
fi
cmp /input/tests/deployment/package-lock.json "${client_dir}/package-lock.json" || {
  echo 'Deployment client dependencies changed: rebuild the deployment image.' >&2
  exit 1
}
rsync -a --delete --exclude=.git --exclude=node_modules --exclude=.env --exclude='.env.*' \
  --exclude=.workbuddy --exclude=playwright-report --exclude=test-results --exclude=__pycache__ \
  /input/ /opt/quickbox-source/
if [[ -d /tmp/quickbox-deployment-client ]]; then
  mv /tmp/quickbox-deployment-client /opt/quickbox-source/tests/deployment/node_modules
fi
rsync -a --delete --exclude=node_modules /baseline-input/ /opt/quickbox-baseline/
cd /opt/quickbox-source
if [[ $# -gt 0 ]]; then exec "$@"; fi
exec python3 tests/deployment/run.py
