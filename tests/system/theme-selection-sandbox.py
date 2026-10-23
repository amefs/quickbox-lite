#!/usr/bin/env python3
"""Theme selection completes when files and nginx reload are ready."""
import os
from pathlib import Path
import shlex
import subprocess
import tempfile

REPO = Path(__file__).resolve().parents[2]

for theme in ('smoked', 'defaulted'):
    for reload_status in (0, 17):
        with tempfile.TemporaryDirectory(prefix='quickbox-theme-') as temporary:
            root = Path(temporary)
            (root / 'dashboard/skins').mkdir(parents=True)
            (root / 'dashboard/db').mkdir()
            for name in ('smoked', 'defaulted'):
                source = root / 'themes' / name / 'skins'
                source.mkdir(parents=True)
                (source / 'theme.css').write_text(name)
            other = 'defaulted' if theme == 'smoked' else 'smoked'
            (root / f'dashboard/db/.{other}.lock').touch()
            script = (REPO / f'packages/system/theme/themeSelect-{theme}').read_text()
            script = script.replace('local_themes=/etc/QuickBox/setup/themes/',
                                    'local_themes=' + shlex.quote(str(root / 'themes') + '/'))
            script = script.replace('dashboard=/srv/dashboard/',
                                    'dashboard=' + shlex.quote(str(root / 'dashboard') + '/'))
            adapters = '''
cp() {
  if [[ "$1" == --remove-destination ]]; then shift; fi
  command cp "$@"
}
service() {
  printf '%s\\n' "$*" >>"$THEME_TEST_LOG"
  return "$THEME_RELOAD_STATUS"
}
'''
            result = subprocess.run(['bash', '-c', adapters + script], capture_output=True, text=True, timeout=3,
                                    env=dict(os.environ, THEME_TEST_LOG=str(root / 'reload.log'),
                                             THEME_RELOAD_STATUS=str(reload_status)))
            assert result.returncode == (0 if reload_status == 0 else 1), result.stderr
            assert (root / 'dashboard/skins/theme.css').read_text() == theme
            assert (root / f'dashboard/db/.{theme}.lock').exists()
            assert not (root / f'dashboard/db/.{other}.lock').exists()
            assert (root / 'reload.log').read_text() == 'nginx reload\n'
            print(f'{theme}, reload status {reload_status}: passed')
