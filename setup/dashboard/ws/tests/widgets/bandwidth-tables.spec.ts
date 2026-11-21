// SPDX-License-Identifier: GPL-3.0-or-later

import "mocha";
import { expect } from "chai";
import fs from "fs";
import path from "path";

import { bandwidthTablesData } from "../../src/services/system/bandwidth";

const dumpsDir = path.join(process.cwd(), "dumps");

const createFixture = (iface: string) => {
    const now = new Date();
    return {
        vnstatversion: "2.10",
        jsonversion: "2",
        interfaces: [
            {
                name: iface,
                alias: "",
                created: {
                    date: { year: now.getFullYear(), month: now.getMonth() + 1, day: 1 },
                    time: { hour: 0, minute: 0 },
                },
                updated: {
                    date: { year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() },
                    time: { hour: now.getHours(), minute: 0 },
                },
                traffic: {
                    total: { rx: 500000000, tx: 250000000 },
                    fiveminute: [],
                    hour: [
                        {
                            id: 0,
                            date: { year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() },
                            time: { hour: 12, minute: 0 },
                            rx: 1024000,
                            tx: 512000,
                        },
                        {
                            id: 1,
                            date: { year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() },
                            time: { hour: 13, minute: 0 },
                            rx: 2048000,
                            tx: 1024000,
                        },
                    ],
                    day: [
                        {
                            id: 0,
                            date: { year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() },
                            rx: 10240000,
                            tx: 5120000,
                        },
                    ],
                    month: [
                        {
                            id: 0,
                            date: { year: now.getFullYear(), month: now.getMonth() + 1 },
                            rx: 102400000,
                            tx: 51200000,
                        },
                    ],
                    top: [
                        {
                            id: 0,
                            date: { year: now.getFullYear(), month: now.getMonth() + 1, day: 15 },
                            rx: 50000000,
                            tx: 25000000,
                        },
                    ],
                },
            },
        ],
    };
};

describe("widgets/bandwidth-tables", () => {
    const testIface = "bwtable-test-iface";
    const dumpPath = path.join(dumpsDir, `vnstat_dump_${testIface}`);

    before(() => {
        fs.mkdirSync(dumpsDir, { recursive: true });
    });

    beforeEach(() => {
        fs.writeFileSync(dumpPath, JSON.stringify(createFixture(testIface)), "utf8");
    });

    afterEach(() => {
        if (fs.existsSync(dumpPath)) {
            fs.rmSync(dumpPath);
        }
    });

    it("should return summary and hourly table by default", async () => {
        const result = await bandwidthTablesData(testIface, undefined);
        expect(result.page).to.equal("h");
        expect(result.summary.map((row) => row.label)).to.deep.equal(["hour", "day", "month", "all"]);
    });

    it("should return hourly data table (page=h)", async () => {
        const result = await bandwidthTablesData(testIface, "h");
        expect(result.page).to.equal("h");
        expect(result.detail.length).to.equal(2);
    });

    it("should return daily data table (page=d)", async () => {
        const result = await bandwidthTablesData(testIface, "d");
        expect(result.page).to.equal("d");
    });

    it("should return monthly data table (page=m)", async () => {
        const result = await bandwidthTablesData(testIface, "m");
        expect(result.page).to.equal("m");
    });

    it("should return top days data table (page=t)", async () => {
        const result = await bandwidthTablesData(testIface, "t");
        expect(result.page).to.equal("t");
    });

    it("should handle missing interface data", async () => {
        if (fs.existsSync(dumpPath)) {
            fs.rmSync(dumpPath);
        }
        const result = await bandwidthTablesData("nonexistent-iface-bwtable", undefined);
        expect(result.summary).to.deep.equal([]);
        expect(result.detail).to.deep.equal([]);
    });

    it("should include numeric byte and speed metrics in output", async () => {
        const result = await bandwidthTablesData(testIface, "h");
        expect(result.detail[0]?.rx).to.be.a("number");
        expect(result.detail[0]?.tx).to.be.a("number");
        expect(result.detail[0]?.rxAvg).to.be.a("number");
        expect(result.detail[0]?.txAvg).to.be.a("number");
    });

    // A3: writeSummary divide-by-zero — created = today → ttime could be 0 at midnight
    it("should render summary without 'Infinity' when created date is today", async () => {
        const now = new Date();
        const todayFixture = {
            vnstatversion: "2.10",
            jsonversion: "2",
            interfaces: [
                {
                    name: testIface,
                    alias: "",
                    created: {
                        date: { year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() },
                        time: { hour: 0, minute: 0 },
                    },
                    updated: {
                        date: { year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() },
                        time: { hour: now.getHours(), minute: 0 },
                    },
                    traffic: {
                        total: { rx: 1024, tx: 512 },
                        fiveminute: [],
                        hour: [{
                            id: 0,
                            date: { year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() },
                            time: { hour: Math.max(0, now.getHours() - 1), minute: 0 },
                            rx: 1024,
                            tx: 512,
                        }],
                        day: [{
                            id: 0,
                            date: { year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() },
                            rx: 1024,
                            tx: 512,
                        }],
                        month: [{
                            id: 0,
                            date: { year: now.getFullYear(), month: now.getMonth() + 1 },
                            rx: 1024,
                            tx: 512,
                        }],
                        top: [],
                    },
                },
            ],
        };
        fs.writeFileSync(dumpPath, JSON.stringify(todayFixture), "utf8");
        const result = await bandwidthTablesData(testIface, undefined);
        const serialized = JSON.stringify(result);
        expect(serialized).to.not.include("Infinity");
        expect(serialized).to.not.include("NaN");
    });
});
