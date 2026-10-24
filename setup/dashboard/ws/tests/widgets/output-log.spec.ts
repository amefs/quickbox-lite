// SPDX-License-Identifier: GPL-3.0-or-later

import "mocha";
import { expect } from "chai";
import fs from "fs";
import os from "os";
import path from "path";

import { readOutputLogAtPath } from "../../src/widgets/output-log";

/**
 * Upper bound documented by `DEFAULT_CONFIG.maxLength` in `src/widgets/output-log.ts`.
 * The assertions below stay meaningful if that value is lowered.
 */
const MAX_LENGTH = 1024 * 1024;

const SAMPLE = "line one\nline two\n";
const SAMPLE_BYTES = Buffer.byteLength(SAMPLE);

/**
 * Run `read` against a real log file in a temporary directory.
 *
 * `readOutputLog()` resolves `setup/dashboard/db/output.log`, which is not part
 * of the repository; reading it returns an empty result and makes every byte
 * assertion trivially true. Driving `readOutputLogAtPath` against known content
 * is the only way to observe the offsets the function reports.
 */
function withLogFile<T>(content: string, read: (logPath: string) => T): T {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "quickbox-output-log-"));
    try {
        const logPath = path.join(directory, "output.log");
        fs.writeFileSync(logPath, content);
        return read(logPath);
    } finally {
        fs.rmSync(directory, { recursive: true, force: true });
    }
}

describe("widgets/output-log", () => {
    it("should return the file content with matching start, end and size", () => {
        withLogFile(SAMPLE, (logPath) => {
            const result = readOutputLogAtPath(logPath);
            expect(result.content).to.equal(SAMPLE);
            expect(result.start).to.equal(0);
            expect(result.end).to.equal(SAMPLE_BYTES);
            expect(result.size).to.equal(SAMPLE_BYTES);
            expect(result.epoch).to.equal("");
        });
    });

    it("should return empty content when offset equals file size", () => {
        withLogFile(SAMPLE, (logPath) => {
            const result = readOutputLogAtPath(logPath, SAMPLE_BYTES);
            expect(result.content).to.equal("");
            expect(result.start).to.equal(SAMPLE_BYTES);
            expect(result.end).to.equal(SAMPLE_BYTES);
            expect(result.size).to.equal(SAMPLE_BYTES);
        });
    });

    it("should read forward from the requested offset", () => {
        withLogFile(SAMPLE, (logPath) => {
            const result = readOutputLogAtPath(logPath, "line one\n".length);
            expect(result.content).to.equal("line two\n");
            expect(result.start).to.equal("line one\n".length);
            expect(result.end).to.equal(SAMPLE_BYTES);
        });
    });

    it("should reset to auto-mode when offset exceeds file size (file truncation)", () => {
        withLogFile(SAMPLE, (logPath) => {
            const result = readOutputLogAtPath(logPath, SAMPLE_BYTES + 999999);
            // Auto-mode returns the tail, which is the whole file here.
            expect(result.content).to.equal(SAMPLE);
            expect(result.start).to.equal(0);
            expect(result.end).to.equal(SAMPLE_BYTES);
        });
    });

    it("should support explicit length parameter", () => {
        withLogFile(SAMPLE, (logPath) => {
            const partial = readOutputLogAtPath(logPath, 0, 10);
            expect(partial.content).to.equal(SAMPLE.slice(0, 10));
            expect(partial.start).to.equal(0);
            expect(partial.end).to.equal(10);
        });
    });

    it("should cap the requested length at maxLength", () => {
        // Twice the documented cap so the clamp is observable.
        const big = "x".repeat(2 * MAX_LENGTH);
        withLogFile(big, (logPath) => {
            const result = readOutputLogAtPath(logPath, 0, Number.MAX_SAFE_INTEGER);
            const bytesReturned = result.end - result.start;
            expect(bytesReturned).to.be.lessThan(result.size);
            expect(bytesReturned).to.be.at.most(MAX_LENGTH);
        });
    });

    it("auto-mode (no offset) should return at most maxLength bytes from the end", () => {
        const big = "y".repeat(2 * MAX_LENGTH);
        withLogFile(big, (logPath) => {
            const result = readOutputLogAtPath(logPath);
            const bytesReturned = result.end - result.start;
            expect(bytesReturned).to.be.at.most(MAX_LENGTH);
            expect(result.start + bytesReturned).to.equal(result.end);
            // The tail ends at the file size, so the newest bytes come back.
            expect(result.end).to.equal(result.size);
            expect(result.start).to.equal(result.size - bytesReturned);
        });
    });

    it("should not reuse cached content after an epoch change", () => {
        const directory = fs.mkdtempSync(path.join(os.tmpdir(), "quickbox-output-log-"));
        const logPath = path.join(directory, "output.log");
        const epochPath = `${logPath}.epoch`;
        const timestamp = new Date(1700000000000);
        try {
            fs.writeFileSync(logPath, "aaaa\n");
            fs.writeFileSync(epochPath, "epoch-one\n");
            fs.utimesSync(logPath, timestamp, timestamp);
            const first = readOutputLogAtPath(logPath, 0, 64, "epoch-one");
            expect(first.content).to.equal("aaaa\n");

            fs.writeFileSync(logPath, "bbbb\n");
            fs.writeFileSync(epochPath, "epoch-two\n");
            fs.utimesSync(logPath, timestamp, timestamp);
            const second = readOutputLogAtPath(logPath, 0, 64, "epoch-one");
            expect(second.epoch).to.equal("epoch-two");
            expect(second.content).to.equal("bbbb\n");
        } finally {
            fs.rmSync(directory, { recursive: true, force: true });
        }
    });

    it("should restart at byte zero when the log epoch changes", () => {
        const directory = fs.mkdtempSync(path.join(os.tmpdir(), "quickbox-output-log-"));
        const logPath = path.join(directory, "output.log");
        try {
            fs.writeFileSync(logPath, "new run begins here\n");
            fs.writeFileSync(`${logPath}.epoch`, "new-epoch\n");
            const result = readOutputLogAtPath(logPath, 12, 64, "old-epoch");
            expect(result.epoch).to.equal("new-epoch");
            expect(result.start).to.equal(0);
            expect(result.content).to.equal("new run begins here\n");
        } finally {
            fs.rmSync(directory, { recursive: true, force: true });
        }
    });

    it("should report an empty result for a log file that does not exist", () => {
        const directory = fs.mkdtempSync(path.join(os.tmpdir(), "quickbox-output-log-"));
        try {
            const result = readOutputLogAtPath(path.join(directory, "missing.log"), 0, 64);
            expect(result).to.deep.equal({ content: "", start: 0, end: 0, size: 0, epoch: "" });
        } finally {
            fs.rmSync(directory, { recursive: true, force: true });
        }
    });
});
