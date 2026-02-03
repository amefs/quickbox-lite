// SPDX-License-Identifier: GPL-3.0-or-later

import "mocha";
import { expect } from "chai";
import * as sinon from "sinon";
import si from "systeminformation";

import { formatSize, formatSpeed, processExists } from "../../src/utils/helpers";

describe("utils/helpers", () => {

    describe("formatSize", () => {
        it("should handle NaN input", () => {
            expect(formatSize(NaN)).to.equal("0 B");
        });

        it("should handle zero", () => {
            expect(formatSize(0)).to.equal("0 B");
        });

        it("should format bytes (B)", () => {
            expect(formatSize(1)).to.equal("1 B");
            expect(formatSize(500)).to.equal("500 B");
            expect(formatSize(1023)).to.equal("1023 B");
        });

        it("should format kilobytes (KB)", () => {
            expect(formatSize(1024)).to.equal("1.00 KB");
            expect(formatSize(1024 * 10)).to.equal("10.00 KB");
        });

        it("should format megabytes (MB)", () => {
            expect(formatSize(1024 * 1024)).to.equal("1.00 MB");
            expect(formatSize(5 * 1024 * 1024)).to.equal("5.00 MB");
        });

        it("should format gigabytes (GB)", () => {
            expect(formatSize(1024 * 1024 * 1024)).to.equal("1.00 GB");
            expect(formatSize(2.5 * 1024 * 1024 * 1024)).to.equal("2.50 GB");
        });

        it("should format terabytes (TB)", () => {
            expect(formatSize(1024 * 1024 * 1024 * 1024)).to.equal("1.00 TB");
        });

        it("should format petabytes (PB)", () => {
            expect(formatSize(1024 * 1024 * 1024 * 1024 * 1024)).to.equal("1.00 PB");
        });

        it("should cap at maximum suffix (YB)", () => {
            expect(formatSize(Math.pow(1024, 10))).to.match(/\d+\.\d+\s+YB/);
        });
    });

    describe("formatSpeed", () => {
        it("should handle very small values as 0 bps", () => {
            expect(formatSpeed(0)).to.equal("0 bps");
            expect(formatSpeed(1e-6)).to.equal("0 bps");
        });

        it("should format bits per second (bps) with default decimals", () => {
            expect(formatSpeed(1)).to.equal("1.000 bps");
            expect(formatSpeed(500)).to.equal("500.000 bps");
        });

        it("should format kilobits per second (Kbps)", () => {
            expect(formatSpeed(1024)).to.equal("1.000 Kbps");
            expect(formatSpeed(2048)).to.equal("2.000 Kbps");
        });

        it("should format megabits per second (Mbps)", () => {
            expect(formatSpeed(1024 * 1024)).to.equal("1.000 Mbps");
            expect(formatSpeed(50 * 1024 * 1024)).to.equal("50.000 Mbps");
        });

        it("should format gigabits per second (Gbps)", () => {
            expect(formatSpeed(1024 * 1024 * 1024)).to.equal("1.000 Gbps");
        });

        it("should respect custom decimals parameter", () => {
            expect(formatSpeed(1024, 1)).to.equal("1.0 Kbps");
            expect(formatSpeed(1024, 2)).to.equal("1.00 Kbps");
            expect(formatSpeed(1024, 4)).to.equal("1.0000 Kbps");
        });

        it("should respect startWith parameter for unit offset", () => {
            expect(formatSpeed(1024 * 1024, 2, 1)).to.equal("1.00 Gbps");
            expect(formatSpeed(1, 2, 1)).to.equal("1.00 Kbps");
        });

        it("should format high-order units", () => {
            expect(formatSpeed(1024 * 1024 * 1024 * 1024)).to.equal("1.000 Tbps");
            expect(formatSpeed(1024 * 1024 * 1024 * 1024 * 1024)).to.equal("1.000 Pbps");
        });
    });

    describe("processExists", () => {
        let stub: sinon.SinonStub;

        beforeEach(() => {
            stub = sinon.stub(si, "processes");
        });

        afterEach(() => {
            stub.restore();
        });

        it("should return true when process exists with matching name and user", async () => {
            stub.resolves({
                list: [
                    { name: "node", user: "testuser" },
                    { name: "python", user: "admin" },
                ],
            });

            const result = await processExists("node", "testuser");
            expect(result).to.equal(true);
        });

        it("should return false when process name matches but user doesn't", async () => {
            stub.resolves({
                list: [
                    { name: "node", user: "testuser" },
                    { name: "node", user: "admin" },
                ],
            });

            const result = await processExists("node", "root");
            expect(result).to.equal(false);
        });

        it("should return false when process doesn't exist", async () => {
            stub.resolves({
                list: [
                    { name: "node", user: "testuser" },
                    { name: "python", user: "admin" },
                ],
            });

            const result = await processExists("nginx", "testuser");
            expect(result).to.equal(false);
        });

        it("should return false when process list is empty", async () => {
            stub.resolves({
                list: [],
            });

            const result = await processExists("node", "testuser");
            expect(result).to.equal(false);
        });

        it("should match first occurrence of matching process", async () => {
            stub.resolves({
                list: [
                    { name: "node", user: "testuser" },
                    { name: "node", user: "testuser" },
                    { name: "node", user: "admin" },
                ],
            });

            const result = await processExists("node", "testuser");
            expect(result).to.equal(true);
        });
    });
});
