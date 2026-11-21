#!/usr/bin/env bash
# Exercise the shipped theme scripts with paths redirected to a private tree.
set -euo pipefail
repo_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
sandbox=$(mktemp -d "${TMPDIR:-/tmp}/quickbox-theme.XXXXXX")
trap 'rm -rf "${sandbox}"' EXIT
mkdir -p "${sandbox}/dashboard/db" "${sandbox}/dashboard/skins" "${sandbox}/bin" "${sandbox}/scripts"
export QB_THEME_SANDBOX="${sandbox}" QB_THEME_REPO="${repo_root}"
python3 - <<'PY'
import os
from pathlib import Path
root = Path(os.environ['QB_THEME_REPO'])
sandbox = Path(os.environ['QB_THEME_SANDBOX'])
for name in ('defaulted', 'smoked'):
    source = (root / 'packages/system/theme' / ('themeSelect-' + name)).read_text()
    old_themes = 'local_themes=/etc/QuickBox/setup/themes/'
    old_dashboard = 'dashboard=/srv/dashboard/'
    assert source.count(old_themes) == source.count(old_dashboard) == 1
    source = source.replace(old_themes, 'local_themes="' + str(root / 'setup/themes') + '/"')
    source = source.replace(old_dashboard, 'dashboard="' + str(sandbox / 'dashboard') + '/"')
    (sandbox / 'scripts' / name).write_text(source)
PY
if command -v gcp >/dev/null 2>&1; then cp_bin=$(command -v gcp); else cp_bin=$(command -v cp); fi
ln -s "${cp_bin}" "${sandbox}/bin/cp"
cat >"${sandbox}/bin/service" <<'SH'
#!/bin/sh
[ "$*" = "nginx reload" ]
SH
cat >"${sandbox}/bin/sleep" <<'SH'
#!/bin/sh
exit 0
SH
chmod +x "${sandbox}/bin/service" "${sandbox}/bin/sleep"
export PATH="${sandbox}/bin:${PATH}"
for theme in smoked defaulted smoked; do
    bash "${sandbox}/scripts/${theme}"
    test -f "${sandbox}/dashboard/db/.${theme}.lock"
    if [ "${theme}" = smoked ]; then other=defaulted; else other=smoked; fi
    test ! -e "${sandbox}/dashboard/db/.${other}.lock"
    for asset in filters.svg resources.svg; do
        cmp "${repo_root}/setup/themes/${theme}/skins/${asset}" "${sandbox}/dashboard/skins/${asset}"
    done
done
printf 'dashboard theme script sandbox checks passed\n'
