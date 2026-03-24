// SPDX-License-Identifier: GPL-3.0-or-later

import { statSync, openSync, readSync, closeSync, existsSync } from "fs";
import path from "path";
import { WatchedConfig } from "../watchedConfig";

let dashboardDir = __dirname;
let lookupDepth = 5;
while (lookupDepth-- > 0) {
    const candidate = path.join(dashboardDir, "db");
    try {
        statSync(candidate);
        break;
    } catch {
        dashboardDir = path.join(dashboardDir, "..");
    }
}

const LOG_PATH = path.join(dashboardDir, "db", "output.log");

interface OutputLogConfig {
    /** Maximum bytes to return per request (default 1 MiB) */
    maxLength: number;
    /** Path to the log file (default: auto-resolved db/output.log) */
    logPath?: string;
}

const DEFAULT_CONFIG: OutputLogConfig = {
    maxLength: 1024 * 1024, // 1 MiB
};

// Look for optional config file alongside other configs
let configDir = __dirname;
let configLookup = 5;
while (configLookup-- > 0) {
    if (existsSync(path.join(configDir, "config", "commands.json"))) {
        break;
    }
    configDir = path.join(configDir, "..");
}

const configPath = path.join(configDir, "config", "dashboard.json");
const dashboardConfig = existsSync(configPath)
    ? new WatchedConfig<{ outputLog?: Partial<OutputLogConfig> }>(configPath)
    : undefined;

function getConfig(): OutputLogConfig {
    const overrides = dashboardConfig?.Value.outputLog;
    return {
        maxLength: overrides?.maxLength ?? DEFAULT_CONFIG.maxLength,
        logPath: overrides?.logPath,
    };
}

function resolveLogPath(): string {
    const cfg = getConfig();
    return cfg.logPath ?? LOG_PATH;
}

export interface OutputLogResult {
    content: string;
    /** Byte offset of the beginning of the returned content */
    start: number;
    /** Byte offset of the end of the returned content (use as offset for next request) */
    end: number;
    /** Total file size in bytes */
    size: number;
}

interface OutputLogCacheEntry extends OutputLogResult {
    bytesToRead: number;
    logPath: string;
    mtimeMs: number;
}

let lastReadCache: OutputLogCacheEntry | undefined;

/**
 * Read output.log with support for incremental and arbitrary-position reads.
 *
 * @param offset - Byte position to start reading from.
 *   - `undefined` or negative: auto-mode — returns the last `maxLength` bytes
 *     (or the whole file if smaller than `maxLength`).
 *   - 0..fileSize: reads from that position.
 *   - > fileSize: file was truncated/rotated — resets to auto-mode.
 * @param length - Maximum number of bytes to read. Capped by configured `maxLength`.
 */
export function readOutputLog(offset?: number, length?: number): OutputLogResult {
    const logPath = resolveLogPath();
    const config = getConfig();

    let stat;
    try {
        stat = statSync(logPath);
    } catch {
        return { content: "", start: 0, end: 0, size: 0 };
    }

    const fileSize = stat.size;
    const mtimeMs = stat.mtimeMs;
    const maxLen = config.maxLength;
    const requestedLen = (length !== undefined && length > 0)
        ? Math.min(length, maxLen)
        : maxLen;

    // Determine start position
    let startPos: number;
    if (offset === undefined || offset < 0 || offset > fileSize) {
        // Auto-mode: return the tail of the file
        startPos = Math.max(0, fileSize - requestedLen);
    } else {
        startPos = offset;
    }

    if (startPos >= fileSize) {
        // No new data
        return { content: "", start: fileSize, end: fileSize, size: fileSize };
    }

    const bytesToRead = Math.min(requestedLen, fileSize - startPos);
    const cached = lastReadCache;
    if (cached &&
        cached.logPath === logPath &&
        cached.mtimeMs === mtimeMs &&
        cached.size === fileSize &&
        cached.start === startPos &&
        cached.bytesToRead === bytesToRead) {
        return {
            content: cached.content,
            start: cached.start,
            end: cached.end,
            size: cached.size,
        };
    }

    const buffer = Buffer.alloc(bytesToRead);

    const fd = openSync(logPath, "r");
    try {
        readSync(fd, buffer, 0, bytesToRead, startPos);
    } finally {
        closeSync(fd);
    }

    const result = {
        content: buffer.toString("utf-8"),
        start: startPos,
        end: startPos + bytesToRead,
        size: fileSize,
    };
    lastReadCache = {
        ...result,
        bytesToRead,
        logPath,
        mtimeMs,
    };
    return result;
}
