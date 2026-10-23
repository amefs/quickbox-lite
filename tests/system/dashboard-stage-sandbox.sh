#!/usr/bin/env bash
# Safe fault-injection checks for Dashboard staging helpers. All file mutations
# are confined to a temporary directory; no real /etc, /srv or /usr/local paths.
set -euo pipefail
repo_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
sandbox=$(mktemp -d "${TMPDIR:-/tmp}/quickbox-stage.XXXXXX")
trap 'rm -rf "${sandbox}"' EXIT
export OUTTO="${sandbox}/out.log" QUICKBOX_BACKUP_DIR="${sandbox}/backups"
export _norm="" _cyan="" _green="" _tan="" _red=""
: >"${OUTTO}"
source "${repo_root}/packages/system/update/qbUpdateDashboard"
source "${repo_root}/packages/system/update/qbUpdateRepo"

# The staging step hands db/tmp to www-data. This sandbox runs unprivileged
# (as CI does), so keep the mode but drop the ownership flags.
install() {
	local args=() arg
	while (($#)); do
		case "$1" in
		-o | --owner | -g | --group)
			shift 2
			;;
		*)
			args+=("$1")
			shift
			;;
		esac
	done
	command install "${args[@]}"
}

live="${sandbox}/live"
stage="${sandbox}/stage"
previous="${sandbox}/previous"
source_tree="${sandbox}/source"
mkdir -p "${live}/ws/node_modules/old-dep" "${live}/db" "${live}/skins" "${source_tree}/ws"
printf 'old package\n' >"${live}/ws/node_modules/old-dep/index.js"
printf 'old runtime\n' >"${live}/ws/dist.js"
printf 'old log\n' >"${live}/db/output.log"
printf 'epoch-old\n' >"${live}/db/output.log.epoch"
printf 'legacy-marker\n' >"${live}/db/output.log.generation"
printf 'new package metadata\n' >"${source_tree}/ws/package.json"
printf 'new runtime\n' >"${source_tree}/ws/dist.js"

mkdir -p "${sandbox}/bin"
cat >"${sandbox}/bin/npm" <<'SH'
#!/bin/sh
exit "${NPM_EXIT:-0}"
SH
chmod +x "${sandbox}/bin/npm"
PATH="${sandbox}/bin:${PATH}" NPM_EXIT=23
export PATH NPM_EXIT
if _dashboardPrepareStage "${live}" "${stage}" "${source_tree}/"; then
  echo "expected injected npm failure" >&2; exit 1
fi
# Preparation failure must leave the live executable and its old dependency intact.
test "$(cat "${live}/ws/dist.js")" = 'old runtime'
test "$(cat "${live}/ws/node_modules/old-dep/index.js")" = 'old package'
rm -rf "${stage}"

NPM_EXIT=0
export NPM_EXIT
_dashboardPrepareStage "${live}" "${stage}" "${source_tree}/"
# Keep the update runner's already-open output descriptor connected across activation.
exec 9>>"${live}/db/output.log"
mv "${live}" "${previous}"
mv "${stage}" "${live}"
printf 'written through old descriptor\n' >&9
exec 9>&-
grep -q 'written through old descriptor' "${live}/db/output.log"
test "$(stat -c %i "${live}/db/output.log" 2>/dev/null || stat -f %i "${live}/db/output.log")" = "$(stat -c %i "${previous}/db/output.log" 2>/dev/null || stat -f %i "${previous}/db/output.log")"
# The epoch marker must survive activation on the same inode as the live log,
# while the pre-rename generation marker is retired.
test "$(cat "${live}/db/output.log.epoch")" = 'epoch-old'
test ! -e "${live}/db/output.log.generation"
test "$(stat -c %i "${live}/db/output.log.epoch" 2>/dev/null || stat -f %i "${live}/db/output.log.epoch")" = "$(stat -c %i "${previous}/db/output.log.epoch" 2>/dev/null || stat -f %i "${previous}/db/output.log.epoch")"

# Backup/restore records missing files and removes newly-created files.
missing="${sandbox}/config/new.conf"
backup="${sandbox}/rollback"
_dashboardBackup "${backup}" "${missing}"
mkdir -p "$(dirname "${missing}")"
: >"${missing}"
_dashboardRestore "${backup}" "${missing}"
test ! -e "${missing}"

# A same-second rerun must not reuse (and overwrite) the earlier directory.
collision="${sandbox}/collision/20240101-000000-dashboard"
mkdir -p "${collision}"
test "$(_dashboardBackupDir "${collision}")" = "${collision}-2"
mkdir -p "${collision}-2"
test "$(_dashboardBackupDir "${collision}")" = "${collision}-3"

# The manifest records mode and checksum, and restore verifies it before use.
managed="${sandbox}/config/managed.conf"
mkdir -p "$(dirname "${managed}")"
printf 'old value\n' >"${managed}"
chmod 0640 "${managed}"
backup2="${sandbox}/rollback2"
_dashboardBackup "${backup2}" "${managed}"
grep -q '^file' "${backup2}/manifest.tsv"
printf 'new value\n' >"${managed}"
chmod 0600 "${managed}"
_dashboardRestore "${backup2}" "${managed}"
test "$(cat "${managed}")" = 'old value'
test "$(stat -c %a "${managed}" 2>/dev/null || stat -f %Lp "${managed}")" = '640'

# A modified backup copy must be rejected instead of restoring corrupt content.
printf 'tampered\n' >>"${backup2}/$(printf '%s' "${managed}" | sed -e 's#/#_#g')"
printf 'changed again\n' >"${managed}"
if _dashboardRestore "${backup2}" "${managed}"; then
  echo 'expected the tampered backup to be rejected' >&2
  exit 1
fi
test "$(cat "${managed}")" = 'changed again'

# _setPerm and _updateskel must return injected normalization/rsync failures.
export QUICKBOX_REPO_ROOT="${sandbox}/repo" QUICKBOX_SKEL_DIR="${sandbox}/skel" local_setup_template="${sandbox}/templates/"
mkdir -p "${QUICKBOX_REPO_ROOT}/packages/system/auxiliary" "${QUICKBOX_SKEL_DIR}" "${local_setup_template}skel"
cat >"${QUICKBOX_REPO_ROOT}/packages/system/auxiliary/qbNormalizeRepo" <<'SH'
exit 29
SH
: >"${local_setup_template}skel/example"
cat >"${sandbox}/bin/rsync" <<'SH'
#!/bin/sh
exit 31
SH
chmod +x "${sandbox}/bin/rsync"
hash -r
if _setPerm; then echo 'expected injected normalization failure' >&2; exit 1; fi
if _updateskel; then echo 'expected injected rsync failure' >&2; exit 1; fi
printf 'dashboard staging sandbox checks passed\n'
