// SPDX-License-Identifier: GPL-3.0-or-later

import "mocha";
import { expect } from "chai";
import fs from "fs";
import path from "path";

import { bwTables } from "../../src/widgets/bw_tables";

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

describe("widgets/bw_tables", () => {
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

    it("should render summary and hourly table by default", async () => {
        const result = await bwTables(testIface, undefined);
        expect(result).to.be.a("string");
        expect(result).to.include("table");
    });

    it("should render hourly data table (page=h)", async () => {
        const result = await bwTables(testIface, "h");
        expect(result).to.include("table");
        expect(result).to.include("PM");
    });

    it("should render daily data table (page=d)", async () => {
        const result = await bwTables(testIface, "d");
        expect(result).to.include("table");
    });

    it("should render monthly data table (page=m)", async () => {
        const result = await bwTables(testIface, "m");
        expect(result).to.include("table");
    });

    it("should render top days data table (page=t)", async () => {
        const result = await bwTables(testIface, "t");
        expect(result).to.include("table");
    });

    it("should handle missing interface data", async () => {
        if (fs.existsSync(dumpPath)) {
            fs.rmSync(dumpPath);
        }
        const result = await bwTables("nonexistent-iface-bwtable", undefined);
        expect(result).to.be.a("string");
        expect(result).to.include("table");
    });

    it("should include formatted sizes in output", async () => {
        const result = await bwTables(testIface, "h");
        expect(result).to.include("KB");
    });

    it("should render with even/odd row classes", async () => {
        const result = await bwTables(testIface, "h");
        expect(result).to.include("label_even");
        expect(result).to.include("label_odd");
    });

    it("should render text-success and text-primary classes for tx/rx", async () => {
        const result = await bwTables(testIface, "h");
        expect(result).to.include("text-success");
        expect(result).to.include("text-primary");
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
        const result = await bwTables(testIface, undefined);
        expect(result).to.be.a("string");
        expect(result).to.not.include("Infinity");
        expect(result).to.not.include("NaN");
    });
});
