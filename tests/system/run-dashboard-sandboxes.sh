#!/usr/bin/env bash
# Run the fast Dashboard deployment checks without changing machine paths.
set -euo pipefail

# Some scripts initialize terminal colors even in non-interactive tests.
export TERM="${TERM:-xterm}"

repo_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
cd "${repo_root}"

scripts=(
	nodejs-update-sandbox.py
	dashboard-stage-sandbox.sh
	qb-ensure-ws-gateway-sandbox.py
	ws-health-startup-sandbox.py
	dashboard-update-sandbox.py
	backup-retention-sandbox.py
	repo-state-revert-sandbox.sh
	repo-reinstall-sandbox.py
	update-config-backup-sandbox.sh
)

for script in "${scripts[@]}"; do
	printf 'Running sandbox: %s\n' "${script}"
	case "${script}" in
	*.py) python3 "tests/system/${script}" ;;
	*.sh) bash "tests/system/${script}" ;;
	esac
done
