#!/usr/bin/env bash
# Exercise the update driver's progress reporting: the shared clock, the
# per-stage durations, the log lines the Dashboard reads, the end-of-run
# summary and the silence-based progress ticks. The driver's option parsing and
# its degraded paths (no timing helper, no usable terminal) are covered here
# too, because this is the only sandbox that sources it. Everything runs inside
# a temporary directory; no real machine path is touched.
set -euo pipefail

repo_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
sandbox=$(mktemp -d "${TMPDIR:-/tmp}/quickbox-timing.XXXXXX")
trap 'rm -rf "${sandbox}"' EXIT

# qbUpdate initializes its terminal colors with `tput` while its definitions
# are sourced below, and `tput` fails for a TERM without terminfo entries (a CI
# runner exports TERM=dumb). The test is about timings, not colours, so the
# terminal is pinned instead of inherited.
export TERM=xterm

################################################################################
# SANDBOX
################################################################################

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
cp "${repo_root}/packages/system/update/qbUpdateStep" "${sandbox}/system/update/qbUpdateStep"
cp "${repo_root}/packages/system/update/qbUpdateLib" "${sandbox}/system/update/qbUpdateLib"
set +u
# shellcheck source=/dev/null
source "${sandbox}/system/qbUpdate"
set -u

OUTTO="${sandbox}/out.log"
export OUTTO
: >"${OUTTO}"

fail() {
	printf '%s\n' "$*" >&2
	exit 1
}

################################################################################
# CLOCK AND FORMATTING
################################################################################

# The clock must be numeric and keep advancing across a real sleep.
first=$(_qbNowMs)
[[ ${first} =~ ^[0-9]+$ ]] || fail "clock is not numeric: ${first}"
sleep 1.1
second=$(_qbNowMs)
(( second - first >= 1000 )) || fail "clock did not advance over 1.1s: ${first} -> ${second}"

# Durations are rendered for logs, so the units have to be stable.
[[ $(_qbFormatMs 0) == '0.0s' ]] || fail 'unexpected 0ms format'
[[ $(_qbFormatMs 938) == '0.9s' ]] || fail 'unexpected subsecond format'
[[ $(_qbFormatMs 12400) == '12.4s' ]] || fail 'unexpected seconds format'
[[ $(_qbFormatMs 65000) == '1m05s' ]] || fail 'unexpected minutes format'
[[ $(_qbFormatMs 3900000) == '1h05m' ]] || fail 'unexpected hours format'

################################################################################
# STAGE REPORTING
################################################################################

step_ok() { sleep 0.2; }
step_fail() { return 9; }

# A finished stage reports on the terminal and in the shared log, and stays
# silent about progress when no terminal is attached (the Dashboard case).
update_started_ms=$(_qbNowMs)
_updateStep "repository" step_ok >"${sandbox}/stage.log"
grep -q '⏱ repository: [0-9]' "${sandbox}/stage.log" || fail 'a finished stage must print its duration'
grep -q '>> Timing: repository took' "${OUTTO}" || fail 'a finished stage must reach the log'
if grep -q 'still running' "${sandbox}/stage.log"; then
	fail 'progress lines must not appear without a terminal'
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
[[ ${fail_status} -eq 1 ]] || fail "failed stage must abort with 1, got ${fail_status}"
grep -q '✗ Update stage failed: dashboard (after ' "${sandbox}/fail.log" || fail 'failure must name the stage and its duration'
grep -q 'dashboard (failed)' "${sandbox}/fail.log" || fail 'the partial report must keep the failed stage'
grep -q '➜ Update timing (total ' "${sandbox}/fail.log" || fail 'a failed run must still print its report'
grep -q '>> Timing: update total ' "${OUTTO}" || fail 'a failed run must still record the total'

# Time that no stage covered is reported instead of being folded into the
# total, so the sum of the rows always explains the whole run.
update_started_ms=$(_qbNowMs)
_updateRecordStage "repository" 100
sleep 1.5
_printUpdateTiming >"${sandbox}/summary.log"
grep -q 'repository ' "${sandbox}/summary.log" || fail 'the report must list every recorded stage'
grep -q 'other (locks, prepare, cleanup)' "${sandbox}/summary.log" || fail 'uncovered time must be named'
grep -q '  total ' "${sandbox}/summary.log" || fail 'the report must end with the total'

################################################################################
# PROGRESS TICKS
################################################################################

# The heartbeat reports silence, not a fixed cadence: every printed line and
# every reported duration refreshes the activity stamp, so a stage that keeps
# producing sub-step timings never also claims to be "still running".
TMPDIR="${sandbox}"
export TMPDIR
_updateActivityInit
[[ -f ${update_activity_file} ]] || fail 'activity stamp was not created'

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
	cat "${busy_out}" >&2
	fail 'a stage that keeps reporting steps must not print heartbeat lines'
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
	cat "${quiet_out}" >&2
	fail 'a silent stage must still report progress'
}

# The stamp is per-run state and must not survive the update.
stamp_file="${update_activity_file}"
_updateCleanup
[[ ! -e ${stamp_file} ]] || fail 'activity stamp was left behind'

################################################################################
# ARGUMENT PARSING
################################################################################

core=0
from_checkout=0
_parseUpdateArgs --only-core
[[ ${core} -eq 1 && ${from_checkout} -eq 0 ]] || fail '--only-core must set only the core flag'

core=0
from_checkout=0
_parseUpdateArgs --from-checkout
[[ ${core} -eq 1 && ${from_checkout} -eq 1 ]] || fail '--from-checkout implies a core update'

unset QB_UPDATE_VERBOSE
_parseUpdateArgs --verbose
[[ ${QB_UPDATE_VERBOSE:-0} -eq 1 ]] || fail '--verbose must reach every sourced stage'
unset QB_UPDATE_VERBOSE

# A typo must fail the run instead of being silently ignored.
if _parseUpdateArgs --nope >/dev/null 2>&1; then
	fail 'unknown options must be rejected'
fi

################################################################################
# DEGRADED PATHS
################################################################################

# A missing helper must degrade to no-op durations instead of failing the
# update: the stages still run, only the measurements disappear.
mkdir -p "${sandbox}/broken/update"
cp "${sandbox}/system/qbUpdate" "${sandbox}/broken/qbUpdate"
cp "${sandbox}/system/update/qbUpdateLib" "${sandbox}/broken/update/qbUpdateLib"
(
	set +u
	# shellcheck source=/dev/null
	source "${sandbox}/broken/qbUpdate" 2>/dev/null
	[[ $(_qbNowMs) == '0' ]] || exit 1
	[[ $(_qbFormatMs 5000) == '5.0s' ]] || exit 1
	_qbReportLap "no helper" 10 || exit 1
	_qbTouchActivity || exit 1
) || fail 'a missing timing helper must not break the driver'

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
	) || fail "sourcing the driver failed with TERM=${terminal:-<unset>}"
done

printf 'update timing sandbox checks passed\n'
