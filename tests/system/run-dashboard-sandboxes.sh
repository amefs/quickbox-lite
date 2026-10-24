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

case "${1:-all}" in
runtime) scripts=(nodejs-update-sandbox.py) ;;
dashboard) scripts=(dashboard-stage-sandbox.sh qb-ensure-ws-gateway-sandbox.py ws-health-startup-sandbox.py dashboard-update-sandbox.py) ;;
backups) scripts=(backup-retention-sandbox.py update-config-backup-sandbox.sh) ;;
repository) scripts=(repo-state-revert-sandbox.sh repo-reinstall-sandbox.py) ;;
progress) scripts=(update-timing-sandbox.sh) ;;
all)
	result=0
	for group in runtime dashboard backups repository progress; do
		bash "${repo_root}/tests/system/run-dashboard-sandboxes.sh" "${group}" || result=1
	done
	exit "${result}"
	;;
*) printf 'Unknown sandbox group: %s\n' "$1" >&2; exit 2 ;;
esac

result=0
for script in "${scripts[@]}"; do
	printf '::group::%s\n' "${script}"
	case "${script}" in
	*.py) python3 "tests/system/${script}" || result=1 ;;
	*.sh) bash "tests/system/${script}" || result=1 ;;
	esac
	printf '::endgroup::\n'
done
exit "${result}"
