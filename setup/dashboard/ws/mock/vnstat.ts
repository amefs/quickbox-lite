// SPDX-License-Identifier: GPL-3.0-or-later

const DUMP_PREFIX = "dumps/vnstat_dump_";

/**
 * Return the interface name when a path points at a vnstat dump file.
 *
 * The reader joins the data directory with the file name, so the resulting
 * path has no leading `./`. Normalizing here keeps the mock working for both
 * `./dumps/...` and `dumps/...` (and for Windows separators).
 */
export function mockVnstatInterface(filePath: string): string | undefined {
    const normalized = filePath.replace(/\\/g, "/").replace(/^\.\/+/, "");
    if (!normalized.startsWith(DUMP_PREFIX)) {
        return undefined;
    }
    return normalized.slice(DUMP_PREFIX.length);
}
