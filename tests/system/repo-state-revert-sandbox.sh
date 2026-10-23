#!/usr/bin/env bash
# Exercise the lightweight pre-update commit record and `qbUpdateRevert`
# against a temporary repository.
set -eo pipefail

# CI runners may not set TERM, but qbUpdate initializes its terminal colors
# while its function definitions are sourced below.
export TERM="${TERM:-xterm}"

repo_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
sandbox=$(mktemp -d "${TMPDIR:-/tmp}/quickbox-repo-state.XXXXXX")
trap 'chmod -R u+w "${sandbox}" 2>/dev/null || true; rm -rf "${sandbox}" 2>/dev/null || true' EXIT

work="${sandbox}/repo"
mkdir -p "${work}"
git init -q "${work}"
git -C "${work}" config user.email sandbox@example.invalid
git -C "${work}" config user.name sandbox
printf 'base\n' >"${work}/tracked.txt"
mkdir -p "${work}/packages/system"
cat >"${work}/packages/system/qbUpdate" <<'SH'
case "$1" in
--from-checkout) ;;
*) exit 42 ;;
esac
git -C "${QUICKBOX_REPO_ROOT}" rev-parse HEAD >"${QUICKBOX_BACKUP_DIR}/reinstalled"
SH
git -C "${work}" add .
git -C "${work}" commit -q -m base
base_sha=$(git -C "${work}" rev-parse HEAD)

mkdir -p "${sandbox}/bin"
cat >"${sandbox}/bin/lsb_release" <<'SH'
#!/bin/sh
case "$1" in
    -is) printf 'Ubuntu\n' ;;
    -cs) printf 'jammy\n' ;;
    *) printf 'Ubuntu\n' ;;
esac
SH
chmod +x "${sandbox}/bin/lsb_release"
PATH="${sandbox}/bin:${PATH}"
# macOS has no flock CLI; exercise the same descriptor locks via Python there.
if ! command -v flock >/dev/null 2>&1; then
	cat >"${sandbox}/bin/flock" <<'PY'
#!/usr/bin/env python3
import fcntl
import sys
try:
    fcntl.flock(int(sys.argv[-1]), fcntl.LOCK_EX | fcntl.LOCK_NB)
except BlockingIOError:
    sys.exit(1)
PY
	chmod +x "${sandbox}/bin/flock"
fi

export QB_UPDATE_LIB_DIR="${repo_root}/packages/system/update"
definitions="${sandbox}/definitions.sh"
sed -n '1,/^# MAIN PROCESS$/p' "${repo_root}/packages/system/qbUpdate" >"${definitions}"
set +u
TERM=xterm
# shellcheck source=/dev/null
source "${definitions}"
set -u

OUTTO="${sandbox}/out.log"
QUICKBOX_BACKUP_DIR="${sandbox}/backups"
QUICKBOX_REPO_ROOT="${work}"
QUICKBOX_UPDATE_CORE_LOCK="${sandbox}/update.lock"
export OUTTO QUICKBOX_BACKUP_DIR QUICKBOX_REPO_ROOT QUICKBOX_UPDATE_CORE_LOCK
: >"${OUTTO}"

# Installation uses the fixture above; repo-reinstall-sandbox.py exercises the
# real update driver and CLI together.
revert="${repo_root}/packages/system/update/qbUpdateRevert"

_saveRepoState
test -f "${QUICKBOX_BACKUP_DIR}/repo-state.env"
test "$(stat -c %a "${QUICKBOX_BACKUP_DIR}/repo-state.env" 2>/dev/null || stat -f %Lp "${QUICKBOX_BACKUP_DIR}/repo-state.env")" = '600'
grep -q "^QUICKBOX_REPO_COMMIT=${base_sha}$" "${QUICKBOX_BACKUP_DIR}/repo-state.env"
grep -q "${base_sha}" "${QUICKBOX_BACKUP_DIR}/repo-history.tsv"
test "$(stat -c %a "${QUICKBOX_BACKUP_DIR}/repo-history.tsv" 2>/dev/null || stat -f %Lp "${QUICKBOX_BACKUP_DIR}/repo-history.tsv")" = '600'
test "$(git -C "${work}" rev-parse refs/quickbox/pre-update-latest)" = "${base_sha}"
test -n "$(git -C "${work}" for-each-ref --format='%(refname)' refs/quickbox/pre-update/)"

# Simulate the destructive update: a new commit becomes the current HEAD.
printf 'updated\n' >"${work}/tracked.txt"
git -C "${work}" add tracked.txt
git -C "${work}" commit -q -m update
test "$(git -C "${work}" rev-parse HEAD)" != "${base_sha}"

# The revert command must refuse to run non-interactively without --yes.
if QUICKBOX_ALLOW_NON_ROOT=1 bash "${revert}" </dev/null >/dev/null 2>&1; then
  echo 'expected the revert command to require confirmation' >&2
  exit 1
fi

QUICKBOX_ALLOW_NON_ROOT=1 bash "${revert}" --yes >/dev/null
test "$(git -C "${work}" rev-parse HEAD)" = "${base_sha}"
test "$(cat "${QUICKBOX_BACKUP_DIR}/reinstalled")" = "${base_sha}"

QUICKBOX_ALLOW_NON_ROOT=1 bash "${revert}" --list \
  >"${sandbox}/list.txt"
grep -q "${base_sha}" "${sandbox}/list.txt"
grep -q 'TIMESTAMP' "${sandbox}/list.txt"

printf 'repo state and revert sandbox checks passed\n'
