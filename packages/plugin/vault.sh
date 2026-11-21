#!/bin/bash
# SPDX-License-Identifier: GPL-3.0-or-later

function _restoreRutorrentPlugins() {
	local vault="${1%/}"
	local destination="$2"
	shift 2
	local plugin source
	local -a sources=()
	for plugin in "$@"; do
		source="${vault}/${plugin}"
		if [[ ! -d ${source} ]]; then
			source="${vault}/plugins/${plugin}"
		fi
		if [[ ! -d ${source} ]]; then
			printf 'Plugin %s is missing from the ruTorrent vault %s\n' "${plugin}" "${vault}" >&2
			return 1
		fi
		sources+=("${source}")
	done
	cp -R -- "${sources[@]}" "${destination}/"
}
