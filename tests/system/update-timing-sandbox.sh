#!/usr/bin/env bash
# Exercise the update timing report: the per-stage durations, the log lines the
# Dashboard reads, the end-of-run summary and the recorded history. Everything
# runs inside a temporary directory; no real machine path is touched.
set -euo pipefail

repo_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
sandbox=$(mktemp -d "${TMPDIR:-/tmp}/quickbox-timing.XXXXXX")
trap 'rm -rf "${sandbox}"' EXIT

# qbUpdate initializes its terminal colors with `tput` while its definitions
# are sourced below, and `tput` fails for a TERM without terminfo entries (a CI
# runner exports TERM=dumb). The test is about timings, not colours, so the
# terminal is pinned instead of inherited.
export TERM=xterm

# The driver reads the distribution at source time; a stub keeps this sandbox
# independent of the host.
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
export PATH

# Source the driver definitions only, exactly like the other sandboxes, so the
# real update entry point never runs. The copy keeps the installed layout
# (system/qbUpdate with its helpers one directory below) because that is what
# the shared clock is resolved against.
mkdir -p "${sandbox}/system/update"
sed -n '1,/^# MAIN PROCESS$/p' "${repo_root}/packages/system/qbUpdate" >"${sandbox}/system/qbUpdate"
cp "${repo_root}/packages/system/update/qbUpdateTimer" "${sandbox}/system/update/qbUpdateTimer"
set +u
# shellcheck source=/dev/null
source "${sandbox}/system/qbUpdate"
set -u

OUTTO="${sandbox}/out.log"
QUICKBOX_BACKUP_DIR="${sandbox}/backups"
mkdir -p "${QUICKBOX_BACKUP_DIR}"
export OUTTO QUICKBOX_BACKUP_DIR
: >"${OUTTO}"

# The clock must be numeric and keep advancing across a real sleep.
first=$(_qbNowMs)
[[ ${first} =~ ^[0-9]+$ ]] || { echo "clock is not numeric: ${first}" >&2; exit 1; }
sleep 1.1
second=$(_qbNowMs)
if (( second - first < 1000 )); then
	echo "clock did not advance over 1.1s: ${first} -> ${second}" >&2
	exit 1
fi

# Durations are rendered for logs, so the units have to be stable.
[[ $(_qbFormatMs 0) == '0.0s' ]] || { echo "unexpected 0ms format" >&2; exit 1; }
[[ $(_qbFormatMs 938) == '0.9s' ]] || { echo "unexpected subsecond format" >&2; exit 1; }
[[ $(_qbFormatMs 12400) == '12.4s' ]] || { echo "unexpected seconds format" >&2; exit 1; }
[[ $(_qbFormatMs 65000) == '1m05s' ]] || { echo "unexpected minutes format" >&2; exit 1; }
[[ $(_qbFormatMs 3900000) == '1h05m' ]] || { echo "unexpected hours format" >&2; exit 1; }

step_ok() { sleep 0.2; }
step_fail() { return 9; }

# A finished stage reports on the terminal and in the shared log, and stays
# silent about progress when no terminal is attached (the Dashboard case).
update_started_ms=$(_qbNowMs)
_updateStep "repository" step_ok >"${sandbox}/stage.log"
grep -q '⏱ repository: [0-9]' "${sandbox}/stage.log"
grep -q '>> Timing: repository took' "${OUTTO}"
if grep -q 'still running' "${sandbox}/stage.log"; then
	echo 'progress lines must not appear without a terminal' >&2
	exit 1
fi

# A failing stage still reports its own duration, keeps the partial report and
# exits non-zero with the stage marked as failed.
set +e
(
	set +e
	update_started_ms=$(_qbNowMs)
	_updateStep "repository" step_ok
	_updateStep "dashboard" step_fail
) >"${sandbox}/fail.log" 2>&1
fail_status=$?
set -e
[[ ${fail_status} -eq 1 ]] || { echo "failed stage must abort with 1, got ${fail_status}" >&2; exit 1; }
grep -q '✗ Update stage failed: dashboard (after ' "${sandbox}/fail.log"
grep -q 'dashboard (failed)' "${sandbox}/fail.log"
grep -q '➜ Update timing (total ' "${sandbox}/fail.log"
grep -q '>> Timing: update total ' "${OUTTO}"

# Time that no stage covered is reported instead of being folded into the
# total, so the sum of the rows always explains the whole run.
update_started_ms=$(_qbNowMs)
_updateRecordStage "repository" 100
sleep 1.5
_printUpdateTiming >"${sandbox}/summary.log"
grep -q 'other (locks, prepare, cleanup)' "${sandbox}/summary.log"
grep -q 'history: ' "${sandbox}/summary.log"

# The history keeps one line per run, newest last, and is capped at 50 runs.
update_started_ms=$(_qbNowMs)
_saveUpdateTiming
history="${QUICKBOX_BACKUP_DIR}/update-timings.tsv"
[[ -f ${history} ]] || { echo "missing timing history: ${history}" >&2; exit 1; }
grep -q 'repository=100' "${history}"
[[ $(awk -F'\t' 'NF != 3' "${history}" | wc -l) -eq 0 ]] || {
	echo 'every history line must hold three tab separated fields' >&2
	exit 1
}
for _ in $(seq 60); do
	printf '20240101-000000\t1000\trepository=100;\n' >>"${history}"
done
update_started_ms=$(_qbNowMs)
_saveUpdateTiming
[[ $(wc -l <"${history}") -le 50 ]] || { echo 'history was not trimmed to 50 runs' >&2; exit 1; }

# The history view renders the recorded runs with their stage rows.
_showUpdateTiming >"${sandbox}/history.log"
grep -q '➜ Update timing history (last 5 runs)' "${sandbox}/history.log"
grep -q 'total ' "${sandbox}/history.log"
grep -q 'repository ' "${sandbox}/history.log"

# A missing backup root disables the history without touching the filesystem
# and without failing the run.
QUICKBOX_BACKUP_DIR="${sandbox}/missing"
export QUICKBOX_BACKUP_DIR
# shellcheck disable=SC2034 # read back by _saveUpdateTiming from the driver
update_started_ms=$(_qbNowMs)
_saveUpdateTiming
[[ ! -e "${sandbox}/missing" ]] || { echo 'a missing backup root must stay untouched' >&2; exit 1; }
_showUpdateTiming >/dev/null 2>&1 && { echo 'history view must fail without a root' >&2; exit 1; }
QUICKBOX_BACKUP_DIR="${sandbox}/backups"
export QUICKBOX_BACKUP_DIR

# Option parsing exposes the history and rejects unknown flags.
show_timings=0
_parseUpdateArgs --timings
[[ ${show_timings} -eq 1 ]] || { echo '--timings was not accepted' >&2; exit 1; }
if _parseUpdateArgs --nope >/dev/null 2>&1; then
	echo 'unknown options must be rejected' >&2
	exit 1
fi

# A missing helper must degrade to no-op durations instead of failing the
# update: the stages still run, only the measurements disappear.
mkdir -p "${sandbox}/broken"
cp "${sandbox}/system/qbUpdate" "${sandbox}/broken/qbUpdate"
(
	set +u
	# shellcheck source=/dev/null
	source "${sandbox}/broken/qbUpdate" 2>/dev/null
	[[ $(_qbNowMs) == '0' ]] || exit 1
	[[ $(_qbFormatMs 5000) == '5.0s' ]] || exit 1
	_qbReportLap "no helper" 10 || exit 1
) || { echo 'a missing timing helper must not break the driver' >&2; exit 1; }

# The colour initialisation must never abort a caller. Sourcing the driver under
# `set -e` with a TERM that has no terminfo entry (a CI runner exports TERM=dumb)
# or with no TERM at all used to kill the script right there, before a single
# stage could report anything; the colours simply have to disappear instead.
for terminal in dumb ''; do
	(
		set -e
		set +u
		TERM="${terminal}"
		export TERM
		# shellcheck source=/dev/null
		source "${sandbox}/system/qbUpdate"
		[[ -z ${_norm} && -z ${_red} && -z ${_cyan} ]] || exit 1
	) || {
		echo "sourcing the driver failed with TERM=${terminal:-<unset>}" >&2
		exit 1
	}
done

printf 'update timing sandbox checks passed\n'
