#!/usr/bin/env bash
# Check the shell scripts used by Dashboard installation and updates.
set -euo pipefail

repo_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
cd "${repo_root}"

scripts=(
	setup.sh
	packages/system/box
	packages/system/qbUpdate
	packages/system/update/qbUpdateDashboard
	packages/package/install/installpackage-vouchproxy
	packages/system/update/qbUpdateRepo
	packages/system/update/qbUpdateService
	packages/system/theme/themeSelect-defaulted
	packages/system/theme/themeSelect-smoked
	packages/system/auxiliary/qbEnsureWsGateway
	packages/system/auxiliary/qbNginxProxyMigrate
	packages/system/auxiliary/qbNormalizeRepo
	packages/system/auxiliary/qbWsHealthCheck
	packages/system/auxiliary/qbEnsureNodejs
	packages/system/auxiliary/qbBackupPrune
	packages/system/update/qbUpdateBackup
	packages/system/update/qbUpdateTimer
	packages/system/update/qbUpdateRevert
	packages/system/auxiliary/qbEnsureSudoers
	packages/system/auxiliary/qbNginxAuth
	scripts/check-system-script-syntax.sh
	tests/system/run-dashboard-sandboxes.sh
)

for script in "${scripts[@]}"; do
	bash -n "${script}"
done
printf 'Syntax checks passed for %s scripts\n' "${#scripts[@]}"
