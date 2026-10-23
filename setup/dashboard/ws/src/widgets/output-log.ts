// SPDX-License-Identifier: GPL-3.0-or-later

import { statSync, openSync, readSync, closeSync, existsSync, readFileSync } from "fs";
import path from "path";
import { WatchedConfig } from "../shared/watched-config";

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
    /**
     * Opaque identity of the current log epoch. It changes whenever `qbUpdate`
     * or `clean_log` intentionally starts a new log. Compare for equality only;
     * the value has no ordering guarantee.
     */
    epoch: string;
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
 * @param expectedEpoch - Epoch the caller's byte offset belongs to. A different
 *   epoch forces a read from byte zero, because offsets do not cross epochs.
 */
export function readOutputLog(offset?: number, length?: number, expectedEpoch?: string): OutputLogResult {
    return readOutputLogAtPath(resolveLogPath(), offset, length, expectedEpoch);
}

function readEpoch(logPath: string): string {
    try {
        return readFileSync(`${logPath}.epoch`, "utf8").trim();
    } catch {
        // Older installations have no epoch marker until the next update.
        return "";
    }
}

export function readOutputLogAtPath(logPath: string, offset?: number, length?: number, expectedEpoch?: string): OutputLogResult {
    let epoch = readEpoch(logPath);
    const config = getConfig();

    let stat;
    try {
        stat = statSync(logPath);
        // Re-check after stat so a reset during this request does not pair a new
        // log body with the previous epoch.
        const currentEpoch = readEpoch(logPath);
        if (currentEpoch !== epoch) {
            epoch = currentEpoch;
            stat = statSync(logPath);
        }
    } catch {
        return { content: "", start: 0, end: 0, size: 0, epoch };
    }

    const fileSize = stat.size;
    const mtimeMs = stat.mtimeMs;
    const maxLen = config.maxLength;
    const requestedLen = (length !== undefined && length > 0)
        ? Math.min(length, maxLen)
        : maxLen;

    // Determine start position
    let startPos: number;
    if (expectedEpoch !== undefined && expectedEpoch !== epoch) {
        // The byte offset belongs to a previous log. Restart at byte zero so
        // the client receives the new epoch's head before it tails.
        startPos = 0;
    } else if (offset === undefined || offset < 0 || offset > fileSize) {
        // Auto-mode: return the tail of the file
        startPos = Math.max(0, fileSize - requestedLen);
    } else {
        startPos = offset;
    }

    if (startPos >= fileSize) {
        // No new data
        return { content: "", start: fileSize, end: fileSize, size: fileSize, epoch };
    }

    const bytesToRead = Math.min(requestedLen, fileSize - startPos);
    const cached = lastReadCache;
    if (cached &&
        cached.logPath === logPath &&
        cached.mtimeMs === mtimeMs &&
        cached.epoch === epoch &&
        cached.size === fileSize &&
        cached.start === startPos &&
        cached.bytesToRead === bytesToRead) {
        return {
            content: cached.content,
            start: cached.start,
            end: cached.end,
            size: cached.size,
            epoch: cached.epoch,
        };
    }

    const buffer = Buffer.alloc(bytesToRead);

    const fd = openSync(logPath, "r");
    let bytesRead: number;
    try {
        bytesRead = readSync(fd, buffer, 0, bytesToRead, startPos);
    } finally {
        closeSync(fd);
    }

    const result = {
        content: buffer.toString("utf-8", 0, bytesRead),
        start: startPos,
        end: startPos + bytesRead,
        size: fileSize,
        epoch,
    };
    lastReadCache = {
        ...result,
        bytesToRead,
        logPath,
        mtimeMs,
        epoch,
    };
    return result;
}
