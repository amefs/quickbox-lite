#!/usr/bin/env bash
#
# [QuickBox Lite Bump Version Script]
#
# GitHub:   https://github.com/amefs/quickbox-lite
# Author:   TautCony
# Current version:  v1.5.8
#
# SPDX-License-Identifier: GPL-3.0-or-later
#
#################################################################################
VERSION=
COMMIT=

_norm=$(tput sgr0)
_red=$(tput setaf 1)
_green=$(tput setaf 2)
_tan=$(tput setaf 3)
_cyan=$(tput setaf 6)

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
    FILE_LIST=(
        packages/package/install/*
        packages/package/remove/*
        packages/package/update/*
        packages/system/*
        packages/system/auxiliary/*
        onekey.sh
        setup.sh
        bump-version.sh
    )

    for file in "${FILE_LIST[@]}"; do
        if [[ -f "$file" ]]; then
            # echo "Bumping version to $version in $file"
            sed -i "s/^# Current version:  .*$/# Current version:  v${VERSION}/" "$file"
            git add "$file"
        fi
    done

    sed -i "s/badge\/version-[^-]*/badge\/version-${VERSION}/" README.md
    sed -i "s/badge\/version-[^-]*/badge\/version-${VERSION}/" README_zh.md
    sed -i "s/QUICKBOX_VERSION=.*$/QUICKBOX_VERSION=v${VERSION}/" setup/templates/motd/01-custom
    sed -i "s/QUICKBOX_VERSION=.*$/QUICKBOX_VERSION=v${VERSION}/" setup/templates/bash_qb.template
    sed -i "s/\$version = 'v[0-9|.]*';$/\$version = 'v${VERSION}';/" setup/dashboard/inc/config.php
    git add README.md
    git add README_zh.md
    git add setup/templates/motd/01-custom
    git add setup/templates/bash_qb.template
    git add setup/dashboard/inc/config.php
}

function _commit_changes() {
    message="Bumped version to $VERSION"

    git flow release start "$VERSION"
    git commit -m "$message"
    git tag -a "$VERSION" -m "$message" || git tag -d "$VERSION"
    git flow release finish "$VERSION" -m "$message"
}

function _usage() {
	echo -e "\nQuickBox Lite Bump Version Script
\nUsage: bash $(basename "$0") -v 1.1.4
\nOptions:
  NOTE: * is required anyway

  -v <version*>                  target version is required
  -c                             run git flow and commit changes
  -h                             display this help and exit"
}

function _main() {
    if [[ -z "$VERSION" ]]; then
        _error "Please specify a version number"
        exit 1
    fi
    base_path="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
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

    _update_version
    _success "Version info updated"

    if [[ -n "$COMMIT" ]]; then
        _commit_changes
        _success "Changes committed"
    fi
}

while getopts "v:hc" OPT; do
    case $OPT in
        v)
            VERSION="${OPTARG}"
            ;;
        c)
            COMMIT=1
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
