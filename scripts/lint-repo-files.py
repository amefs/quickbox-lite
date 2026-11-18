#!/usr/bin/env python3
# Author: TautCony
"""Check the executable-bit and line-ending contract of tracked files.

Policy:

* A tracked regular file is executable (mode 100755) when its first line starts
  with ``#!``; every other tracked regular file is mode 100644.
* Every tracked text file uses LF line endings.
* Every executable file ends with a newline.

The check is read-only. ``--fix`` repairs executable-bit drift in the Git index
and in the working tree; it never rewrites line endings because that must go
through ``git add --renormalize`` and a reviewed commit.
"""

import argparse
import os
from pathlib import Path
import subprocess
import sys

REPO = Path(__file__).resolve().parents[1]
MODE_EXEC = '100755'
MODE_FILE = '100644'
REGULAR_MODES = {MODE_EXEC, MODE_FILE}


def git(root, *args):
    return subprocess.run(
        ['git', '-C', str(root), *args],
        check=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )


def tracked_files(root):
    """Yield (mode, object id, path) for every tracked file, NUL-delimited."""
    for record in git(root, 'ls-files', '-s', '-z').stdout.split(b'\0'):
        if not record:
            continue
        meta, separator, path = record.partition(b'\t')
        if not separator:
            continue
        fields = meta.split(b' ', 2)
        mode = fields[0].decode('ascii')
        yield mode, fields[1].decode('ascii'), os.fsdecode(path)


def worktree_eol_states(root):
    """Map path to the ``git ls-files --eol`` state string."""
    states = {}
    for record in git(root, 'ls-files', '--eol', '-z').stdout.split(b'\0'):
        if not record:
            continue
        meta, separator, path = record.partition(b'\t')
        if not separator:
            continue
        states[os.fsdecode(path)] = meta.decode('ascii', 'replace')
    return states


def first_bytes(path, count=4096):
    try:
        with open(path, 'rb') as handle:
            return handle.readline(count)
    except OSError:
        return b''


def ends_with_newline(path):
    try:
        with open(path, 'rb') as handle:
            handle.seek(0, os.SEEK_END)
            if handle.tell() == 0:
                return False
            handle.seek(-1, os.SEEK_END)
            return handle.read(1) == b'\n'
    except OSError:
        return True


def eol_problem(meta):
    if '/-text' in meta:
        return None
    if 'w/crlf' in meta or 'w/mixed' in meta:
        return 'worktree uses CRLF; convert it to LF'
    if 'i/crlf' in meta or 'i/mixed' in meta:
        return 'index uses CRLF; run git add --renormalize and commit'
    return None


def fix_modes(root, entries, mode):
    """Update both the index and the worktree mode without staging content.

    ``git update-index --chmod`` refreshes the index entry from the worktree.
    That would silently stage unrelated content edits, so keep the existing
    blob id and change only the mode.
    """
    for path, object_id in entries:
        git(root, 'update-index', '--cacheinfo', mode, object_id, path)
        target = root / path
        if target.exists() and not target.is_symlink():
            os.chmod(target, 0o755 if mode == MODE_EXEC else 0o644)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=REPO,
                        help='repository root (default: the checkout containing this script)')
    parser.add_argument('--fix', action='store_true',
                        help='repair executable-bit drift in the index and working tree')
    args = parser.parse_args()
    root = args.root.resolve()

    files = list(tracked_files(root))
    states = worktree_eol_states(root)
    mode_drift = {MODE_EXEC: [], MODE_FILE: []}
    errors = []

    for mode, object_id, path in files:
        if mode not in REGULAR_MODES:
            continue
        target = root / path
        script = first_bytes(target).startswith(b'#!')
        expected = MODE_EXEC if script else MODE_FILE
        if mode != expected:
            mode_drift[expected].append((path, object_id))
        if script and not ends_with_newline(target):
            errors.append((path, 'executable file does not end with a newline'))
        problem = eol_problem(states.get(path, ''))
        if problem:
            errors.append((path, problem))

    if args.fix:
        for mode, entries in mode_drift.items():
            if entries:
                fix_modes(root, entries, mode)
                print(f'fixed mode: {len(entries)} file(s) set to {mode}')
        mode_drift = {MODE_EXEC: [], MODE_FILE: []}

    for mode, entries in mode_drift.items():
        for path, _ in entries:
            errors.append((path, f'expected mode {mode}, found {MODE_FILE if mode == MODE_EXEC else MODE_EXEC}'))

    for path, message in errors:
        print(f'{path}: {message}', file=sys.stderr)

    if errors:
        print(f'{len(errors)} repository file contract error(s)', file=sys.stderr)
        return 1
    print(f'checked {len(files)} tracked files; executable bits and line endings are consistent')
    return 0


if __name__ == '__main__':
    sys.exit(main())
