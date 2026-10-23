#!/usr/bin/env bash
# Exercise the update timing report: the per-stage durations, the log lines the
# Dashboard reads, the end-of-run summary and the silence-based progress ticks.
# Everything runs inside a temporary directory; no real machine path is touched.
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

# The report is all a run leaves behind: nothing is written to the backup root,
# and there is no history to read back later.
if grep -q 'history' "${sandbox}/summary.log"; then
	echo 'the summary must not advertise a timing history' >&2
	exit 1
fi
[[ -z $(find "${QUICKBOX_BACKUP_DIR}" -name 'update-timings.tsv' -print -quit) ]] || {
	echo 'the update must not record timing history' >&2
	exit 1
}

# Option parsing still rejects unknown flags, and --timings is gone for good.
if _parseUpdateArgs --timings >/dev/null 2>&1; then
	echo '--timings must no longer be accepted' >&2
	exit 1
fi
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

# The heartbeat reports silence, not a fixed cadence. A stage that keeps
# printing sub-step durations is visibly working and must not also claim to be
# "still running"; only a stage that goes quiet earns a progress line.
TMPDIR="${sandbox}"
export TMPDIR
_updateActivityInit
[[ -f ${update_activity_file} ]] || { echo 'activity stamp was not created' >&2; exit 1; }

busy_probe() {
	local i
	for i in 1 2 3 4 5; do
		_qbReportMs "step ${i}" 100
		sleep 0.4
	done
}

busy_out="${sandbox}/heartbeat-busy.log"
(
	_updateHeartbeatLoop 1 "probe" terminal "$(_qbNowMs)"
) >"${busy_out}" &
busy_pid=$!
busy_probe >/dev/null
kill "${busy_pid}" 2>/dev/null
wait "${busy_pid}" 2>/dev/null || true
if grep -q 'still running' "${busy_out}"; then
	echo 'a stage that keeps reporting steps must not print heartbeat lines' >&2
	cat "${busy_out}" >&2
	exit 1
fi

quiet_out="${sandbox}/heartbeat-quiet.log"
(
	_updateHeartbeatLoop 1 "probe" terminal "$(_qbNowMs)"
) >"${quiet_out}" &
quiet_pid=$!
sleep 1.8
kill "${quiet_pid}" 2>/dev/null
wait "${quiet_pid}" 2>/dev/null || true
grep -q 'probe still running (no output for ' "${quiet_out}" || {
	echo 'a silent stage must still report progress' >&2
	cat "${quiet_out}" >&2
	exit 1
}

# The stamp is per-run state and must not survive the update.
stamp_file="${update_activity_file}"
_updateCleanup
[[ ! -e ${stamp_file} ]] || { echo 'activity stamp was left behind' >&2; exit 1; }

printf 'update timing sandbox checks passed\n'
