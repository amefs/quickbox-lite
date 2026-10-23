// SPDX-License-Identifier: GPL-3.0-or-later

import "mocha";
import { expect } from "chai";
import fs from "fs";
import os from "os";
import path from "path";

import { readOutputLog, readOutputLogAtPath } from "../../src/widgets/output-log";

describe("widgets/output-log", () => {
    it("should return an object with content, start, end, and size", () => {
        const result = readOutputLog();
        expect(result).to.have.property("content").that.is.a("string");
        expect(result).to.have.property("start").that.is.a("number");
        expect(result).to.have.property("end").that.is.a("number");
        expect(result).to.have.property("size").that.is.a("number");
        expect(result).to.have.property("epoch").that.is.a("string");
        expect(result.start).to.be.at.least(0);
        expect(result.end).to.be.at.least(result.start);
        expect(result.size).to.be.at.least(result.end);
    });

    it("should return empty content when offset equals file size", () => {
        const first = readOutputLog();
        const second = readOutputLog(first.end);
        expect(second.content).to.equal("");
        expect(second.start).to.equal(first.size);
        expect(second.end).to.equal(first.size);
    });

    it("should handle offset=0 reading from start", () => {
        const result = readOutputLog(0);
        expect(result.start).to.equal(0);
    });

    it("should reset to auto-mode when offset exceeds file size (file truncation)", () => {
        const first = readOutputLog();
        const result = readOutputLog(first.size + 999999);
        // Auto-mode returns the tail
        expect(result.content).to.equal(first.content);
        expect(result.end).to.equal(first.end);
    });

    it("should support explicit length parameter", () => {
        const full = readOutputLog(0);
        if (full.size > 10) {
            const partial = readOutputLog(0, 10);
            expect(partial.content).to.have.lengthOf.at.most(10);
            expect(partial.start).to.equal(0);
            expect(partial.end).to.equal(10);
        }
    });

    it("should cap length at maxLength", () => {
        // Request a huge length — should be capped by config.maxLength
        const result = readOutputLog(0, Number.MAX_SAFE_INTEGER);
        expect(result.end - result.start).to.be.at.most(1024 * 1024); // default 1 MiB
    });

    it("auto-mode (no offset) should return at most maxLength bytes from the end", () => {
        const result = readOutputLog();
        const bytesReturned = result.end - result.start;
        expect(bytesReturned).to.be.at.most(1024 * 1024);
        // start + returned = end
        expect(result.start + bytesReturned).to.equal(result.end);
        // end should equal file size (we read to the end)
        expect(result.end).to.equal(result.size);
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
});
