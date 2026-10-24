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

group="${1:-all}"

# The group -> script manifest lives in tests/system/test_sandboxes.py, so this
# wrapper holds no list of its own and every script is individually runnable:
#   python3 -m unittest tests.system.test_sandboxes -k backup_retention -v
if [[ "${group}" == "all" ]]; then
	exec python3 -m unittest tests.system.test_sandboxes -v
fi

if ! python3 -m tests.system.test_sandboxes --groups | grep -qx "${group}"; then
	printf 'Unknown sandbox group: %s\n' "${group}" >&2
	exit 2
fi
exec python3 -m unittest tests.system.test_sandboxes -k "test_${group}_" -v
