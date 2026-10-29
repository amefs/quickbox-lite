# Package lifecycle script conventions

The `install/installpackage-*`, `remove/removepackage-*` and
`update/updatepackage-*` scripts in this directory share one script framework.
When adding or changing a package, start from
[`install.sh.template`](templates/install.sh.template),
[`remove.sh.template`](templates/remove.sh.template) and
[`update.sh.template`](templates/update.sh.template).
The templates are standalone Bash files meant to be copied; deployed scripts
never read a template or load an extra shared library.

## Running the checks

From the repository root:

```sh
python3 scripts/lint-package-scripts.py
uv run --locked pytest tests/lint
```

The checks need only the system Python 3 standard library and Bash; no Python
package has to be installed. Each script locates the repository from its own
path, so it can be called from any working directory. To check a specific
package directory:

```sh
python3 scripts/lint-package-scripts.py --root /path/to/packages/package
```

`--root` must contain `install`, `remove` and `update` directories; the rules
still come from this repository's templates. The linter is read-only by
default: it validates syntax with `bash -n` and never executes or sources a
package script. It exits 0 on success, 1 on a convention violation and 2 when a
dependency or read fails. Every error carries the file path, line number and
rule name. The `package-script-linter` job in GitHub Actions runs both the
linter and its regression tests.

## File layout

Files are UTF-8, use LF line endings, end with a newline and start with
`#!/bin/bash`. The header carries a fixed field set in a fixed order, with
values aligned to column 20:

```bash
#!/bin/bash
#
# [QuickBox Lite Authelia Installer]
#
# GitHub:           https://github.com/amefs/quickbox-lite
# Author:           Amefs
# Maintainer:       Amefs
# Current version:  v1.6.1
# Original Repo:    https://github.com/QuickBox/QB
# Credits to:       QuickBox.io
#
# SPDX-License-Identifier: GPL-3.0-or-later
#
################################################################################
```

`GitHub`, `Author`, `Current version` and the SPDX identifier are mandatory; add
`Maintainer` only when the maintainer differs from the author, and
`Original Repo` / `Credits to` only when an upstream exists. The order is fixed
as `GitHub → Author → Maintainer → Current version → Original Repo → Credits to`;
never keep an empty `URL:` field. `Current version` is maintained by
`scripts/bump-version.sh` — do not change the label or its two spaces, and the template
directory is part of the version scan. Keep one empty `#` after the title and
one before the SPDX line; after the empty `#` that follows SPDX, only
`# shellcheck` directives are allowed. The header holds comments only, and the
license block keeps its closing full-line `#` separator. That separator and the
top border of the next section are two distinct lines; a section title may
appear only inside a complete banner, never repeated outside one. All three
scripts of a package must agree on the header field values; the linter checks
required fields, order, alignment, empty values and cross-script differences.
Templates use `Author: <author>` and a placeholder version — replace the author
and the optional source fields after copying. Sections appear in this order,
each title wrapped in 80 `#` characters above and below:

| Section | Contents |
| --- | --- |
| `CORE VARIABLE` (optional) | runtime environment setup, existing shell options |
| `HELP FUNCTIONS` | terminal colours, NEWT palette and log helpers identical to the templates |
| `APP VARIABLE` | package identity, service name, dependencies, default log path and package-specific variables |
| `SCRIPT FUNCTIONS` | `_usage` and shared helpers such as version comparison |
| `INSTALL FUNCTIONS` / `REMOVE FUNCTIONS` / `UPDATE FUNCTIONS` | lock handling and business functions for the matching action |
| `OPT GENERATOR` | shared option loop plus package-specific option branches |
| `MAIN PROCESS` | lifecycle calls in dependency order |

The linter rejects unknown section titles and separators that are not exactly 80
characters; the single `#` lines in the license header are exempt.

Every outer function uses a multiline definition:

```bash
function _configureApp() {
	# Package-specific configuration.
	_info "Configuring ${APP_TITLE}..."
}
```

`function name() {` must sit on one line; `name() {`, `function name {`, moving
`{` to the next line and one-line functions are all rejected, so a definition
cannot slip past the duplicate and required-function checks. Function sections
contain definitions and comments only; real work is called from the main process
after option parsing. The shared helpers and the option framework keep the
templates' tab indentation; package-specific bodies, their conditionals and
existing indentation may stay as they are. Configurations and embedded scripts
produced inside a heredoc are excluded from the outer layout checks and keep
their own indentation.

## Metadata and logging

```bash
APP_TITLE="Example App"
APP_NAME="example"
APP_SERVICE="example"
APP_BASEDEPS=""
APP_LOCK=".${APP_NAME}.lock"
OUTTO="/srv/dashboard/db/output.log"
```

`APP_TITLE` and `APP_NAME` must be non-empty double-quoted strings and identical
across the three scripts of a package. The filename follows the public package
identifier, while `APP_NAME` may use the real application name — `cifs` maps to
`samba`, for example. Declare `APP_SERVICE` and `APP_BASEDEPS` when the package
has a service or dependencies; omit them otherwise. None of the core metadata
may be assigned twice.

The global operation lock is `/install/.install.lock`; package install markers
keep their current granularity. When declared, `APP_LOCK` is either
`".${APP_NAME}.lock"` or `".${username}.${APP_NAME}.lock"`. Scripts that already
use a user-level marker path may keep it — never change lock granularity for the
sake of uniformity.

`HELP FUNCTIONS` provides `_execute`, `_print`, `_info`, `_success`, `_warning`
and `_error`. Log output is appended to `OUTTO` by default; `-l` / `--log`
overrides it. `_execute` keeps the project's existing single-command-string
convention; commands that need pipes, redirection or complex quoting should be
written directly in Bash with an explicit log redirect.

## Option conventions

Every script offers `-h` / `--help` and `-l` / `--log <logfile>` and documents
them in `_usage`. Help exits 0; `getopt` rejecting an argument exits 1. Use GNU
getopt:

```bash
if ! ARGS=$(getopt -a -o hl: -l help,log: -- "$@"); then
	_usage
	exit 1
fi
eval set -- "${ARGS}"
```

Keep the quoting around `"$@"`, `eval set -- "${ARGS}"` and `OUTTO="$2"` so that
values containing spaces or single quotes survive. `_usage` must document every
short and long option declared to getopt; the linter reports missing ones.
Package-specific options are declared in getopt's short and long lists and
handled in a branch placed after the shared `--help` / `--log` branches and
before `--)`. Every declaration needs a handling branch and every branch needs a
declaration, and aliases must agree on whether a value is required. An option
that takes a value shifts exactly once inside its branch and reads `$2`; an
option that takes none never shifts there. The linter checks both.

```bash
	-v | --version)
		version="$2"
		shift
		;;
```

Never keep a declared option without real behaviour; when adding one, update the
usage example and description in `_usage` as well.

## Lifecycle conventions

| Action | Opening steps (fixed order) | Middle steps | Closing step |
| --- | --- | --- | --- |
| install | `_lockCheck` → `_setLock` → `_installInfo` | add sources, install dependencies, install or configure the application, call `_installAppLock`, start services as needed | `_lockCleanup` |
| remove | `_lockCheck` → `_setLock` → `_removeInfo` | stop services, remove dependencies or the application, call `_removeAppLock` as needed | `_lockCleanup` |
| update | `_lockCheck` → `_setLock` → `_updateInfo` | call `_updateApp`, reconfigure and restart services as needed | `_lockCleanup` |

`_usage` lives in `SCRIPT FUNCTIONS`; the other required lifecycle functions live
in the function section of their action. `_lockCheck` inspects the global
operation lock and the package's own preconditions, `_setLock` writes the global
operation lock, and `_lockCleanup` removes it or calls an existing
`_clearInstallLock` to do so. `_installAppLock` must create the package install
marker and `_removeAppLock` must remove it; an empty success helper does not
count as lock handling. When `APP_LOCK` is declared, install/remove/update must
use the same expression. The main process may add conditionals as a package
needs, and every function it calls must be defined.

A package may need only dependency installation or only configuration; there is
no requirement to add empty install, service or dependency functions. The
placeholder business functions in the templates exit with an error, so implement
the real behaviour before using a copy. The linter checks the framework, the
option wiring and Bash syntax; runtime behaviour — whether downloads succeed,
how command failures are handled, lock concurrency and cleanup after errors —
still needs functional testing of the package itself.
