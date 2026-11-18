#!/usr/bin/env bash
#
# [QuickBox Lite Bump Version Script]
#
# GitHub:           https://github.com/amefs/quickbox-lite
# Author:           TautCony
# Current version:  v1.6.1
#
# SPDX-License-Identifier: GPL-3.0-or-later
#
################################################################################

VERSION=
COMMIT=
DRY_RUN=
VERSION_PATTERN='^[0-9]+\.[0-9]+\.[0-9]+$'

_norm=$(tput sgr0 2>/dev/null || true)
_red=$(tput setaf 1 2>/dev/null || true)
_green=$(tput setaf 2 2>/dev/null || true)
_tan=$(tput setaf 3 2>/dev/null || true)
_cyan=$(tput setaf 6 2>/dev/null || true)

function _print() {
	printf "${_norm}%s${_norm}\n" "$@"
}
function _info() {
	printf "${_cyan}➜ %s${_norm}\n" "$@"
}
function _success() {
	printf "${_green}✓ %s${_norm}\n" "$@"
}
function _warning() {
	printf "${_tan}⚠ %s${_norm}\n" "$@"
}
function _error() {
	printf "${_red}✗ %s${_norm}\n" "$@"
}
function _run() {
    if [[ -n "$DRY_RUN" ]]; then
        _info "[dry-run] $*"
    else
        "$@"
    fi
}

function _sed_in_place() {
    if [[ "$(uname -s)" == Darwin ]]; then
        _run sed -i '' -E "$@"
    else
        _run sed -i -E "$@"
    fi
}

function _check_gitflow() {
    master_branch=$(git config --get gitflow.branch.master) || return 1
    develop_branch=$(git config --get gitflow.branch.develop) || return 1
    git show-ref --verify --quiet refs/heads/"${master_branch}" || return 1
    git show-ref --verify --quiet refs/heads/"${develop_branch}" || return 1
}

function _init_gitflow() {
    git flow init -d || return 1
}

function _update_version() {
    FILE_LIST=()
    while IFS= read -r -d '' file; do
        FILE_LIST+=("$file")
    done < <(find \
        packages/package/install \
        packages/package/remove \
        packages/package/update \
        packages/package/templates \
        packages/system \
        setup/scripts \
        -type f -print0 2>/dev/null)
    FILE_LIST+=(
        onekey.sh
        setup.sh
        scripts/bump-version.sh
        packages/package/README.md
        setup/templates/motd/01-custom
    )

    for file in "${FILE_LIST[@]}"; do
        if [[ -f "$file" ]] && grep -qE '^# Current version:[[:space:]]+v[0-9]+\.[0-9]+\.[0-9]+' "$file"; then
            _sed_in_place "s|^# Current version:[[:space:]]+v[0-9]+\.[0-9]+\.[0-9]+.*$|# Current version:  v${VERSION}|" "$file" || return 1
            _run git add "$file" || return 1
        fi
    done

    _sed_in_place "s/badge\/version-[^-]*/badge\/version-${VERSION}/" README.md || return 1
    _sed_in_place "s/badge\/version-[^-]*/badge\/version-${VERSION}/" README_zh.md || return 1
    _sed_in_place "s|^QUICKBOX_VERSION=.*$|QUICKBOX_VERSION=v${VERSION}|" setup/templates/motd/01-custom || return 1
    _sed_in_place "s|^QUICKBOX_VERSION=.*$|QUICKBOX_VERSION=v${VERSION}|" setup/templates/bash_qb.template || return 1
    _sed_in_place "s|^([[:space:]]*\"version\"[[:space:]]*:[[:space:]]*\")[0-9]+\.[0-9]+\.[0-9]+(\"[[:space:]]*,?[[:space:]]*)$|\\1${VERSION}\\2|" setup/dashboard/ws/package.json || return 1
    # Only the first two version fields belong to this package; later fields
    # describe dependencies and must remain unchanged.
    _sed_in_place "1,10s|^([[:space:]]*\"version\"[[:space:]]*:[[:space:]]*\")[0-9]+\.[0-9]+\.[0-9]+(\"[[:space:]]*,?[[:space:]]*)$|\\1${VERSION}\\2|" setup/dashboard/ws/package-lock.json || return 1
    _run git add README.md README_zh.md setup/templates/motd/01-custom \
        setup/templates/bash_qb.template setup/dashboard/ws/package.json \
        setup/dashboard/ws/package-lock.json || return 1
}

function _commit_changes() {
    message="Bumped version to $VERSION"

    if [[ -n "$DRY_RUN" ]]; then
        _info "[dry-run] git flow release start \"$VERSION\""
        _info "[dry-run] git commit -m \"$message\""
        _info "[dry-run] git tag -a \"$VERSION\" -m \"$message\""
        _info "[dry-run] git flow release finish \"$VERSION\" -m \"$message\""
        return
    fi

    git flow release start "$VERSION"
    git commit -m "$message"
    git tag -a "$VERSION" -m "$message" || git tag -d "$VERSION"
    git flow release finish "$VERSION" -m "$message"
}

function _usage() {
	echo -e "\nQuickBox Lite Bump Version Script
\nUsage: bash scripts/$(basename "$0") -v 1.1.4
\nOptions:
  NOTE: * is required anyway

  -v <version*>                  target version is required
  -c                             run git flow and commit changes
  -n                             dry-run mode (preview only, no file changes)
  -h                             display this help and exit"
}

function _main() {
    if [[ -z "$VERSION" ]]; then
        _error "Please specify a version number"
        exit 1
    fi
    if [[ ! "$VERSION" =~ $VERSION_PATTERN ]]; then
        _error "Invalid version format: $VERSION (expected: x.y.z)"
        exit 1
    fi
    base_path="$( cd "$( dirname "${BASH_SOURCE[0]}" )/.." >/dev/null 2>&1 && pwd )"
    cd "$base_path" || exit 1

    if [[ -n "$COMMIT" ]]; then
        if ! _check_gitflow; then
            if ! _init_gitflow; then
                _error "Failed to initialize gitflow"
                exit 1
            else
                _success "Initialized gitflow"
            fi
        else
            _info "Gitflow is already initialized"
        fi
    fi

    if ! _update_version; then
        _error "Failed to update version information"
        exit 1
    fi
    _success "Version info updated"

    if [[ -n "$COMMIT" ]]; then
        _commit_changes
        _success "Changes committed"
    fi
}

while getopts "v:hcn" OPT; do
    case $OPT in
        v)
            VERSION="${OPTARG}"
            ;;
        c)
            COMMIT=1
            ;;
        n)
            DRY_RUN=1
            ;;
        h)
            _usage
            exit 0
            ;;
        *)
            _usage
            exit 1
            ;;
    esac
done

_main
