#!/usr/bin/env bash
# Exercise the qbUpdate configuration snapshot and rollback without touching
# real /etc paths. The managed-path policy is replaced with sandbox files.
set -euo pipefail

repo_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
sandbox=$(mktemp -d "${TMPDIR:-/tmp}/quickbox-update-config.XXXXXX")
running_pid=""
trap 'if [[ -n "${running_pid}" ]]; then kill "${running_pid}" 2>/dev/null || true; wait "${running_pid}" 2>/dev/null || true; fi; rm -rf "${sandbox}"' EXIT

mkdir -p "${sandbox}/bin" "${sandbox}/etc"
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
local_prefix="${repo_root}/"
export OUTTO QUICKBOX_BACKUP_DIR local_prefix
: >"${OUTTO}"
_loadBackupHelper
test "${update_backup_available}" = 1

# An existing shared root must not be chmodded, and its warning must not
# contaminate the path captured from stdout.
shared_root="${sandbox}/shared"
mkdir -p "${shared_root}"
chmod 0777 "${shared_root}"
saved_backup_root="${QUICKBOX_BACKUP_DIR}"
QUICKBOX_BACKUP_DIR="${shared_root}"
captured_root=$(_qbBackupRoot 2>"${sandbox}/root-warning.log")
test "${captured_root}" = "${shared_root}"
test "$(stat -c %a "${shared_root}" 2>/dev/null || stat -f %Lp "${shared_root}")" = '777'
grep -q 'writable by group/other' "${sandbox}/root-warning.log"
QUICKBOX_BACKUP_DIR="${saved_backup_root}"

managed="${sandbox}/etc/managed.conf"
created="${sandbox}/etc/created.conf"
printf 'before\n' >"${managed}"
chmod 0640 "${managed}"
_managedUpdatePaths() {
	printf '%s\n' "${managed}" "${created}"
}
update_backup_available=1

_backupUpdateConfig
test "${update_backup_ready}" = 1
test -n "${update_backup_dir}"
case "${update_backup_dir}" in
*-update) ;;
*) echo "unexpected backup directory: ${update_backup_dir}" >&2; exit 1 ;;
esac
grep -q '^file' "${update_backup_dir}/manifest.tsv"
grep -q '^absent' "${update_backup_dir}/manifest.tsv"

printf 'after\n' >"${managed}"
chmod 0600 "${managed}"
printf 'must be removed\n' >"${created}"
_restoreUpdateConfig
test "$(cat "${managed}")" = 'before'
test "$(stat -c %a "${managed}" 2>/dev/null || stat -f %Lp "${managed}")" = '640'
test ! -e "${created}"

# A service-stage rollback also reloads system services; stub both commands so
# this test stays hermetic.
systemctl() { return 0; }
nginx() { return 0; }
update_service_started=1
_restoreUpdateConfig

# A second restore runs after the first one already consumed the snapshot: it
# must be idempotent rather than re-applying or deleting the restored file.
test "$(cat "${managed}")" = 'before'
test "$(stat -c %a "${managed}" 2>/dev/null || stat -f %Lp "${managed}")" = '640'
test ! -e "${created}"

# A binary can still be executing during rollback (ttyd on a real update).
# Restore by replacing its inode while the existing process keeps running.
if [[ $(uname -s) == Linux ]]; then
	binary="${sandbox}/running-sleep"
	cp /bin/sleep "${binary}"
	_qbBackupCreate "${sandbox}/binary-backup" "${binary}"
	"${binary}" 30 &
	running_pid=$!
	sleep 0.1
	_qbBackupRestoreAll "${sandbox}/binary-backup"
	kill -0 "${running_pid}"
	cmp /bin/sleep "${binary}"
	kill "${running_pid}"
	wait "${running_pid}" 2>/dev/null || true
	running_pid=""
fi

# Atomic restore must preserve an enabled site's symlink and update its target.
target="${sandbox}/etc/site.conf"
link="${sandbox}/etc/enabled.conf"
printf 'original site\n' >"${target}"
chmod 0640 "${target}"
ln -s "${target}" "${link}"
_qbBackupCreate "${sandbox}/link-backup" "${link}"
printf 'changed site\n' >"${target}"
chmod 0777 "${target}"
_qbBackupRestoreAll "${sandbox}/link-backup"
test -L "${link}"
test "$(cat "${target}")" = 'original site'
test "$(stat -c %a "${target}" 2>/dev/null || stat -f %Lp "${target}")" = 640

# A failed rename leaves the live file intact and records the failing path and
# command error in the same log as the rollback verdict.
printf 'keep live file\n' >"${target}"
mv() { printf 'fixture rename denied\n' >&2; return 19; }
if _qbBackupRestoreAll "${sandbox}/link-backup"; then
	echo 'failed rename must fail the rollback' >&2; exit 1
fi
unset -f mv
test "$(cat "${target}")" = 'keep live file'
grep -q 'Cannot replace rollback destination .*enabled.conf (exit 19): fixture rename denied' "${OUTTO}"
test -z "$(find "${sandbox}/etc" -name '.qb-restore.*' -print)"

# Report activation failures explicitly and never reload partially restored files.
nginx() { [[ "$*" != '-s reload' ]] || { printf 'fixture reload denied\n' >&2; return 29; }; }
if _restoreUpdateConfig; then
	echo 'nginx reload failure must fail rollback' >&2; exit 1
fi
grep -q 'Managed rollback: nginx reload failed' "${OUTTO}"
grep -q 'fixture reload denied' "${OUTTO}"
systemctl() { printf 'called\n' >>"${sandbox}/activation"; }
nginx() { printf 'called\n' >>"${sandbox}/activation"; }
rm "${update_backup_dir}/$(printf '%s' "${managed}" | sed 's#/#_#g')"
if _restoreUpdateConfig; then
	echo 'missing backup must fail rollback' >&2; exit 1
fi
test ! -e "${sandbox}/activation"

printf 'update config backup sandbox checks passed\n'
