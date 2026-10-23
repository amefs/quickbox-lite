#!/usr/bin/env bash
# Run the fast Dashboard deployment checks without changing machine paths.
set -euo pipefail

# A sandbox must not inherit the ambient terminal: the scripts it sources
# initialize their colours with `tput`, and CI runners export TERM=dumb. The
# colour initialisation is guarded (see update-timing-sandbox.sh), but pinning a
# real terminal keeps these checks identical on every host.
export TERM=xterm

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
	update-timing-sandbox.sh
)

for script in "${scripts[@]}"; do
	printf 'Running sandbox: %s\n' "${script}"
	case "${script}" in
	*.py) python3 "tests/system/${script}" ;;
	*.sh) bash "tests/system/${script}" ;;
	esac
done
