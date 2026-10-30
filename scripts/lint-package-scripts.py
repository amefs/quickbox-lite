#!/usr/bin/env python3
"""Read-only checks for package lifecycle scripts; never source or run them."""

import argparse
from collections import Counter
from pathlib import Path
import re
import shutil
import subprocess
import sys


REPO = Path(__file__).resolve().parents[1]
PACKAGE = REPO / 'packages/package'
ROLES = {'install': 'Installer', 'remove': 'Remover', 'update': 'Updater'}
SEPARATOR = '#' * 80
SECTION = re.compile(r'^#{80}\n# ([A-Z ]+)\n#{80}\n', re.M)
SECTION_TITLE = re.compile(
    r'^# (CORE VARIABLE|HELP FUNCTIONS|APP VARIABLE|SCRIPT FUNCTIONS|'
    r'INSTALL FUNCTIONS|REMOVE FUNCTIONS|UPDATE FUNCTIONS|OPT GENERATOR|MAIN PROCESS)$', re.M)
SECTION_NAMES = {'CORE VARIABLE', 'HELP FUNCTIONS', 'APP VARIABLE', 'SCRIPT FUNCTIONS',
                 'INSTALL FUNCTIONS', 'REMOVE FUNCTIONS', 'UPDATE FUNCTIONS',
                 'OPT GENERATOR', 'MAIN PROCESS'}
BANNER = re.compile(r'^#{80}\n# ([^\n]+)\n#{80}\n', re.M)
HASH_LINE = re.compile(r'^#+$', re.M)
FUNCTION = re.compile(r'^(?:function )?(\w+)\(\)[ \t]*\{[^\n]*\n', re.M)
FUNCTION_LIKE = re.compile(
    r'^(?:function[ \t]+(?P<keyword>\w+)(?:[ \t]*\([ \t]*\))?|'
    r'(?P<plain>\w+)[ \t]*\([ \t]*\))[ \t]*(?:\{.*)?$', re.M)
HEREDOC = re.compile(r'''(?<!<)<<(?P<tabs>-?)[ \t]*(?:'(?P<single>\w+)'|"(?P<double>\w+)"|(?P<bare>\w+))''')
GETOPT = re.compile(r'\Aif ! ARGS=\$\(getopt -a -o ([\w:]+) -l ([\w,:-]+) -- "\$@"\); then\n')
CASE = re.compile(r'^\t((?:-[\w]|--[\w-]+)(?: \| (?:-[\w]|--[\w-]+))*)\)\n(.*?)\t\t;;\n', re.M | re.S)
HEADER_FIELDS = ('GitHub', 'Author', 'Maintainer', 'Current version', 'Original Repo', 'Credits to')
HEADER_REQUIRED = {'GitHub', 'Author', 'Current version'}
HEADER_VALUE_COLUMN = 20


def shell_view(source):
    """Blank heredoc payloads, preserving offsets for diagnostics and slicing.

    Package scripts use word delimiters (quoted or unquoted) and may use <<-.
    This is a scaffold reader, not a general-purpose Bash parser. Bash itself
    checks syntax; generated configs and embedded scripts are opaque here.
    """
    pending = []
    result = []
    for line in source.splitlines(keepends=True):
        if pending:
            delimiter, strip_tabs = pending[0]
            candidate = line.lstrip('\t') if strip_tabs else line
            if candidate.rstrip('\r\n') == delimiter:
                pending.pop(0)
            result.append(''.join('\n' if char == '\n' else ' ' for char in line))
            continue
        result.append(line)
        for match in HEREDOC.finditer(line):
            delimiter = match['single'] or match['double'] or match['bare']
            pending.append((delimiter, bool(match['tabs'])))
    return ''.join(result)


def header_lines(source):
    """Return the header lines before the first 80-hash delimiter."""
    result = []
    for line in source.splitlines(keepends=True):
        if line.rstrip('\n') == SEPARATOR:
            break
        result.append(line)
    return result


def header_fields(source):
    fields = {}
    for line in header_lines(source):
        match = re.match(r'^# ([A-Za-z ]+):[ \t]*(.*?)[ \t]*$', line.rstrip('\n'))
        if match and match[1] in HEADER_FIELDS:
            fields[match[1]] = match[2]
    return fields


def check_header_schema(source, error):
    raw = header_lines(source)
    lines = [line.rstrip('\n') for line in raw]

    def fail(index, message):
        error('header', message, sum(len(line) for line in raw[:index]))

    if len(lines) < 4:
        fail(0, 'header is incomplete')
        return
    if lines[0] != '#!/bin/bash':
        fail(0, 'first line must be #!/bin/bash with LF line endings')
    if lines[1] != '#':
        fail(1, 'use a blank # line after the shebang')
    if not re.fullmatch(r'# \[QuickBox Lite .+ (?:Installer|Remover|Updater)\]', lines[2]):
        fail(2, 'second header line must be the lifecycle title')
    if lines[3] != '#':
        fail(3, 'use a blank # line after the lifecycle title')
    spdx = next((index for index, line in enumerate(lines)
                 if line == '# SPDX-License-Identifier: GPL-3.0-or-later'), None)
    if spdx is None:
        fail(0, 'missing SPDX license identifier')
        return
    body = lines[4:spdx]
    if not body or body[-1] != '#':
        fail(spdx, 'use a blank # line before the SPDX identifier')
        fields = body
    else:
        fields = body[:-1]
    labels = []
    for offset, line in enumerate(fields, start=4):
        match = re.match(r'^# ([A-Za-z ]+):( *)(.*)$', line)
        if not match:
            fail(offset, 'header fields must use "# Label: value"')
            continue
        label, spaces, value = match.groups()
        if label not in HEADER_FIELDS:
            fail(offset, 'unknown header field: ' + label)
            continue
        expected = HEADER_VALUE_COLUMN - len('# ' + label + ':')
        if len(spaces) != expected:
            fail(offset, f'{label}: must align its value at column {HEADER_VALUE_COLUMN}')
        if not value.strip():
            fail(offset, label + ': must not be empty')
        if label in labels:
            fail(offset, 'duplicate header field: ' + label)
        labels.append(label)
    indices = [HEADER_FIELDS.index(label) for label in labels if label in HEADER_FIELDS]
    if indices != sorted(indices):
        fail(4, 'header fields must follow this order: ' + ', '.join(HEADER_FIELDS))
    for label in sorted(HEADER_REQUIRED - set(labels)):
        fail(4, 'missing required header field: ' + label)
    if spdx + 1 >= len(lines) or lines[spdx + 1] != '#':
        fail(spdx, 'use a blank # line after the SPDX identifier')
        return
    for offset, line in enumerate(lines[spdx + 2:], start=spdx + 2):
        if not line.startswith('# shellcheck '):
            fail(offset, 'only # shellcheck directives may follow the license header')


def sections(source):
    matches = list(SECTION.finditer(shell_view(source)))
    return [(match[1], match.end(), matches[index + 1].start() if index + 1 < len(matches) else len(source))
            for index, match in enumerate(matches)]


def section_bodies(source):
    return {name: source[start:end].strip() for name, start, end in sections(source)}


def functions(source):
    view = shell_view(source)
    found = []
    for match in FUNCTION.finditer(view):
        if match[0].strip().endswith('}'):
            end = match.end()
        else:
            close = re.search(r'^}\n', view[match.end():], re.M)
            if not close:
                continue
            end = match.end() + close.end()
        found.append((match[1], match.start(), end))
    return found


def render_options(template, short, long, extra=''):
    return (template.replace('-o hl:', '-o ' + short, 1)
            .replace('-l help,log:', '-l ' + long, 1)
            .replace('\t--)\n', extra + '\t--)\n', 1))


def check_options(source, template, error):
    match = GETOPT.match(source + '\n')
    if not match:
        error('options', 'use the template getopt header and quote "$@"')
        return {}
    short, long = match.groups()
    valid_short = re.fullmatch(r'(?:[A-Za-z0-9]:?)+', short)
    valid_long = re.fullmatch(r'[a-z][a-z0-9-]*:?(?:,[a-z][a-z0-9-]*:?)*', long)
    if not valid_short or not valid_long:
        error('options', 'options must be flags or require one value (a single colon)')
    cases = list(CASE.finditer(source + '\n'))
    extra = ''.join(case[0] for case in cases if case[1] not in ('-h | --help', '-l | --log'))
    if source != render_options(template, short, long, extra):
        error('options', 'option loop differs from template (help exits 0, log is quoted, eval set -- "${ARGS}")')
    declared = {}
    short_specs = re.findall(r'(\w)(:?)', short)
    long_specs = [value.partition(':') for value in long.split(',')]
    for name, colon in short_specs:
        declared['-' + name] = bool(colon)
    for name, colon, _ in long_specs:
        declared['--' + name] = bool(colon)
    if len(declared) != len(short_specs) + len(long_specs):
        error('options', 'duplicate getopt declaration')
    if not all(declared.get(flag) == arity for flag, arity in
               [('-h', False), ('--help', False), ('-l', True), ('--log', True)]):
        error('options', 'declare -h/--help and -l/--log (log requires a value)')
    handled = []
    for case in cases:
        flags = case[1].split(' | ')
        handled.extend(flags)
        arities = {declared[flag] for flag in flags if flag in declared}
        if len(arities) > 1:
            error('options', 'aliases disagree about requiring a value: ' + case[1])
        shifts = re.findall(r'^\t\tshift$', case[2], re.M)
        if arities == {True}:
            if len(shifts) != 1:
                error('options', 'value option must shift its argument once: ' + case[1])
            if not re.search(r'\$(?:\{)?2\b', case[2]):
                error('options', 'value option must read $2: ' + case[1])
        elif arities == {False} and shifts:
            error('options', 'flag option must not shift its argument: ' + case[1])
    for flag in sorted(set(declared) - set(handled)):
        error('options', 'declared option has no handler: ' + flag)
    for flag in sorted(set(handled) - set(declared)):
        error('options', 'handler has no getopt declaration: ' + flag)
    for flag, count in Counter(handled).items():
        if count > 1:
            error('options', 'duplicate option handler: ' + flag)
    return declared


def check_section_markers(view, error):
    banners = list(SECTION.finditer(view))
    title_offsets = {match.start() + len(SEPARATOR) + 1 for match in banners}
    for match in SECTION_TITLE.finditer(view):
        if match.start() not in title_offsets:
            error('sections', 'stray or duplicate section title outside a complete banner: ' + match[1], match.start())
    for match in BANNER.finditer(view):
        if match[1] not in SECTION_NAMES:
            error('sections', 'unknown section title: ' + match[1], match.start())
    for match in HASH_LINE.finditer(view):
        if len(match[0]) >= 20 and len(match[0]) != 80:
            error('sections', "section separators must be exactly 80 '#' characters", match.start())


def check_metadata(blocks, header, action, error):
    title = re.search(r'^APP_TITLE="([^"\n]+)"$', blocks['APP VARIABLE'], re.M)
    app = re.search(r'^APP_NAME="([a-z0-9-]+)"$', blocks['APP VARIABLE'], re.M)
    if not title or not app:
        error('metadata', 'declare a quoted, nonempty APP_TITLE and lowercase APP_NAME')
    elif f'# [QuickBox Lite {title[1]} {ROLES[action]}]\n' not in header:
        error('header', 'title must match APP_TITLE and the lifecycle action')
    if 'OUTTO="/srv/dashboard/db/output.log"' not in blocks['APP VARIABLE'].splitlines():
        error('metadata', 'declare OUTTO="/srv/dashboard/db/output.log" in APP VARIABLE')
    for variable in ['APP_TITLE', 'APP_NAME', 'APP_LOCK', 'OUTTO']:
        declarations = re.findall(r'^' + variable + r'=(.*)$', blocks['APP VARIABLE'], re.M)
        if len(declarations) > 1:
            error('metadata', 'duplicate metadata assignment: ' + variable)
        if variable == 'APP_LOCK' and declarations and declarations[0] not in (
                '".${APP_NAME}.lock"', '".${username}.${APP_NAME}.lock"'):
            error('metadata', 'quote APP_LOCK using ${APP_NAME} (optionally scoped by ${username})')


def check_function_declarations(source, view, layout, starts, action, error):
    found = functions(source)
    declaration_view = view
    for _, start, end in reversed(found):
        declaration_view = (declaration_view[:start]
                            + '\n' * declaration_view[start:end].count('\n')
                            + declaration_view[end:])
    for match in FUNCTION_LIKE.finditer(declaration_view):
        error('format', 'function declarations must use: function name() {', match.start())
    for name, count in Counter(name for name, _, _ in found).items():
        if count > 1:
            error('functions', 'duplicate function definition: ' + name)
    for name, start, _ in found:
        if not source[start:].startswith(f'function {name}() {{\n'):
            error('format', 'use a multiline function declaration: function ' + name + '() {', start)
    required = ['_usage', '_lockCheck', '_setLock', '_lockCleanup', '_' + action + 'Info']
    required += {'install': ['_installAppLock'], 'remove': ['_removeAppLock'], 'update': ['_updateApp']}[action]
    bodies = {name: source[start:end] for name, start, end in found}
    for name in required:
        if name not in bodies:
            error('functions', 'missing lifecycle function: ' + name)
    for name, start, _ in found:
        allowed = ['HELP FUNCTIONS', 'SCRIPT FUNCTIONS', action.upper() + ' FUNCTIONS']
        if not any(label in allowed and begin <= start < end for label, begin, end in layout):
            error('functions', name + ' must be defined in a function section', start)
        if name in required:
            section = 'SCRIPT FUNCTIONS' if name == '_usage' else action.upper() + ' FUNCTIONS'
            section_end = next(end for label, _, end in layout if label == section)
            if not starts[section] <= start < section_end:
                error('functions', name + ' belongs in ' + section, start)
    return required, bodies


def check_section_purity(blocks, action, error):
    # Executable lifecycle work belongs inside functions, before option parsing.
    for section in ['SCRIPT FUNCTIONS', action.upper() + ' FUNCTIONS']:
        body = blocks[section] + '\n'
        view = shell_view(body)
        for _, start, end in reversed(functions(body)):
            view = view[:start] + '\n' * view[start:end].count('\n') + view[end:]
        if any(line.strip() and not line.lstrip().startswith('#') for line in view.splitlines()):
            error('functions', section + ' must contain only function definitions and comments')


def check_locks(bodies, action, error):
    for name in ['_lockCheck', '_setLock']:
        if name in bodies and '/install/.install.lock' not in bodies[name]:
            error('locks', name + ' must check/set the global operation lock')
    cleanup = bodies.get('_lockCleanup', '')
    if '/install/.install.lock' not in cleanup and '_clearInstallLock' not in cleanup:
        error('locks', '_lockCleanup must release the global operation lock')
    if action == 'install' and not re.search(r'\btouch[ \t]+"?/install/', bodies.get('_installAppLock', '')):
        error('locks', '_installAppLock must create the package lock')
    if action == 'remove' and not re.search(r'\brm[ \t]+-f[ \t]+"?/install/', bodies.get('_removeAppLock', '')):
        error('locks', '_removeAppLock must remove the package lock')


def check_usage_documents(declared, usage, error):
    for flag in sorted(declared):
        if flag in ('-h', '--help', '-l', '--log'):
            continue
        if flag.startswith('--'):
            present = re.search(r'(?<![\w-])' + re.escape(flag) + r'(?![\w-])', usage)
        else:
            present = (re.search(r'(?<![\w-])-' + re.escape(flag[1]) + r'(?![\w-])', usage)
                       or re.search(r'\[-[A-Za-z]*' + re.escape(flag[1]) + r'[A-Za-z]*\]', usage))
        if not present:
            error('usage', 'document ' + flag + ' in _usage')


def check_main(blocks, bodies, required, action, error):
    main = [line.strip() for line in shell_view(blocks['MAIN PROCESS']).splitlines()
            if line.strip() and not line.lstrip().startswith('#')]
    prefix = ['_lockCheck', '_setLock', '_' + action + 'Info']
    if main[:3] != prefix or main[-1:] != ['_lockCleanup']:
        error('lifecycle', 'main must start with ' + ', '.join(prefix) + ' and end with _lockCleanup')
    for line in main:
        if not re.fullmatch(r'_\w+(?:[ \t]+[^;]+)?|(?:if|elif) \[\[ .* \]\]; then|else|fi', line):
            error('lifecycle', 'put executable steps in functions; main allows calls and [[ ]] conditionals')
            break
    calls = re.findall(r'^\s*(_\w+)(?:\s|$)', blocks['MAIN PROCESS'], re.M)
    for name in calls:
        if name not in bodies:
            error('lifecycle', 'main calls an undefined function: ' + name)
    for name in required[4:]:
        if name not in calls:
            error('lifecycle', 'main must call ' + name)


def check_script(path, action, templates):
    errors = []
    locations = {}

    def error(rule, message, offset=None):
        if offset is None:
            offset = locations.get(rule, 0)
        line = source.count('\n', 0, offset) + 1
        errors.append(f'{path}:{line}: [{rule}] {message}')

    try:
        source = path.read_bytes().decode('utf-8')
    except (OSError, UnicodeError) as exc:
        return [f'{path}:1: [read] {exc}']
    if not source.startswith('#!/bin/bash\n'):
        error('header', 'first line must be #!/bin/bash with LF line endings')
    if '\r' in source or not source.endswith('\n'):
        error('format', 'use LF line endings and a final newline')
    syntax = subprocess.run(['bash', '-n', str(path)], capture_output=True, text=True)
    if syntax.returncode:
        error('syntax', syntax.stderr.strip())
        return errors
    view = shell_view(source)
    check_section_markers(view, error)
    layout = sections(source)
    names = [name for name, _, _ in layout]
    expected = ['HELP FUNCTIONS', 'APP VARIABLE', 'SCRIPT FUNCTIONS', action.upper() + ' FUNCTIONS',
                'OPT GENERATOR', 'MAIN PROCESS']
    if names[:1] == ['CORE VARIABLE']:
        names = names[1:]
    if names != expected:
        error('sections', 'expected ordered sections: [CORE VARIABLE], ' + ', '.join(expected))
        return errors
    blocks = section_bodies(source)
    starts = {name: start for name, start, _ in layout}
    locations.update({
        'metadata': starts['APP VARIABLE'], 'helpers': starts['HELP FUNCTIONS'],
        'options': starts['OPT GENERATOR'], 'lifecycle': starts['MAIN PROCESS'],
        'functions': starts[action.upper() + ' FUNCTIONS'], 'locks': starts[action.upper() + ' FUNCTIONS'],
        'usage': starts['SCRIPT FUNCTIONS'],
    })
    header = ''.join(header_lines(source))
    if any(line.strip() and not line.startswith('#') for line in header.splitlines()):
        error('header', 'only comments and blank lines may precede the first section')
    check_header_schema(source, error)
    check_metadata(blocks, header, action, error)
    if blocks['HELP FUNCTIONS'] != templates[action]['HELP FUNCTIONS']:
        error('helpers', 'HELP FUNCTIONS must match the template logging/UI helpers')
    required, bodies = check_function_declarations(source, view, layout, starts, action, error)
    check_section_purity(blocks, action, error)
    usage = bodies.get('_usage', '')
    if ROLES[action] not in usage or '--help' not in usage or '--log' not in usage:
        error('usage', '_usage must describe the action, --help and --log')
    check_locks(bodies, action, error)
    declared = check_options(blocks['OPT GENERATOR'], templates[action]['OPT GENERATOR'], error)
    check_usage_documents(declared, usage, error)
    check_main(blocks, bodies, required, action, error)
    return errors


def lint(root):
    templates = {}
    errors = []
    paths = []
    for action in ROLES:
        template = PACKAGE / 'templates' / (action + '.sh.template')
        templates[action] = section_bodies(template.read_text())
        if not (root / action).is_dir():
            errors.append(f'{root / action}:1: [inventory] missing lifecycle directory')
            continue
        for path in sorted((root / action).iterdir()):
            if not path.is_file() or not re.fullmatch(action + r'package-[a-z0-9-]+', path.name):
                errors.append(f'{path}:1: [inventory] expected {action}package-<name> file')
                continue
            paths.append((path, action))
    for action in ROLES:
        template = PACKAGE / 'templates' / (action + '.sh.template')
        errors.extend(check_script(template, action, templates))
        for section in ['HELP FUNCTIONS', 'OPT GENERATOR']:
            if templates[action][section] != templates['install'][section]:
                errors.append(f'{template}:1: [templates] {section} must be identical in all three templates')
    if not paths:
        errors.append(f'{root}:1: [inventory] no package lifecycle scripts found')
    identities = {}
    app_locks = {}
    header_values = {}
    inventories = {action: set() for action in ROLES}
    for path, action in paths:
        errors.extend(check_script(path, action, templates))
        name = path.name.split('package-', 1)[1]
        inventories[action].add(name)
        try:
            text = path.read_text()
            metadata = section_bodies(text).get('APP VARIABLE', '')
        except (OSError, UnicodeError):
            continue  # check_script already reported the unreadable file.
        values = dict(re.findall(r'^(APP_TITLE|APP_NAME)="([^"\n]+)"$', metadata, re.M))
        identity = (values.get('APP_TITLE'), values.get('APP_NAME'))
        if name in identities and identities[name] != identity:
            errors.append(f'{path}:1: [metadata] APP_TITLE/APP_NAME must agree across lifecycle scripts')
        identities[name] = identity
        lock = re.search(r'^APP_LOCK="([^"\n]+)"$', metadata, re.M)
        if lock:
            if name in app_locks and app_locks[name] != lock[1]:
                errors.append(f'{path}:1: [metadata] APP_LOCK must agree across lifecycle scripts')
            app_locks[name] = lock[1]
        fields = header_fields(text)
        if name in header_values:
            for field in HEADER_FIELDS:
                if header_values[name].get(field) != fields.get(field):
                    errors.append(f'{path}:1: [header] {field} must agree across lifecycle scripts')
        header_values[name] = fields
    for action in ['remove', 'update']:
        for name in sorted(inventories[action] - inventories['install']):
            errors.append(f'{root / action}:1: [inventory] {name} has no installer')
    for name in sorted(inventories['install'] - inventories['remove']):
        errors.append(f'{root / "install"}:1: [inventory] {name} has no remover')
    return errors, len(paths)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=PACKAGE,
                        help='package tree containing install/remove/update (default: repository package tree)')
    args = parser.parse_args()
    if not shutil.which('bash'):
        parser.exit(2, 'error: bash is required for syntax checks\n')
    try:
        errors, count = lint(args.root.resolve())
    except (OSError, UnicodeError, KeyError) as exc:
        parser.exit(2, f'error: cannot read package scripts/templates: {exc}\n')
    for error in errors:
        print(error, file=sys.stderr)
    if errors:
        print(f'Package script lint failed: {len(errors)} error(s), {count} script(s).', file=sys.stderr)
        return 1
    print(f'Package script lint passed: {count} scripts (install/remove/update).')
    return 0


if __name__ == '__main__':
    sys.exit(main())
