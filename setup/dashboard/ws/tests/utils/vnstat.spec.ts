// SPDX-License-Identifier: GPL-3.0-or-later

import "mocha";
import { expect } from "chai";
import fs from "fs";
import path from "path";

import { getVnstatData } from "../../src/utils/vnstat";

const dumpsDir = path.join(process.cwd(), "dumps");

const cleanupDumpFiles = () => {
    if (!fs.existsSync(dumpsDir)) {
        return;
    }
    for (const file of fs.readdirSync(dumpsDir)) {
        if (file.startsWith("vnstat_dump_test")) {
            fs.rmSync(path.join(dumpsDir, file));
        }
    }
};

describe("vnstat utils", () => {
    before(() => {
        fs.mkdirSync(dumpsDir, { recursive: true });
    });

    afterEach(() => {
        cleanupDumpFiles();
    });

    it("should return empty dataset when dump does not exist", async () => {
        const iface = "test-empty-iface";
        const data = await getVnstatData(iface);
        expect(data.hour).to.have.length(0);
        expect(data.day).to.have.length(0);
        expect(data.month).to.have.length(0);
        expect(data.top).to.have.length(0);
        expect(data.summary.interface).to.equal(iface);
    });

    it("should parse vnstat dump data correctly", async () => {
        const iface = "testiface";
        const dumpPath = path.join(dumpsDir, `vnstat_dump_${iface}`);
        const fixture = {
            vnstatversion: "2.10",
            jsonversion: "2",
            interfaces: [
                {
                    name: iface,
                    alias: "",
                    created: {
                        date: { year: 2022, month: 12, day: 1 },
                        time: { hour: 0, minute: 0 },
                    },
                    updated: {
                        date: { year: 2023, month: 1, day: 1 },
                        time: { hour: 12, minute: 0 },
                    },
                    traffic: {
                        total: { rx: 100000, tx: 200000 },
                        fiveminute: [],
                        tops: [],
                        hour: [
                            {
                                id: 0,
                                date: { year: 2023, month: 1, day: 1 },
                                time: { hour: 12, minute: 0 },
                                rx: 3600,
                                tx: 1800,
                            },
                        ],
                        day: [
                            {
                                id: 0,
                                date: { year: 2023, month: 1, day: 1 },
                                rx: 86400,
                                tx: 43200,
                            },
                        ],
                        month: [
                            {
                                id: 0,
                                date: { year: 2023, month: 1 },
                                rx: 172800,
                                tx: 86400,
                            },
                        ],
                        top: [
                            {
                                id: 0,
                                date: { year: 2022, month: 12, day: 31 },
                                rx: 1000,
                                tx: 2000,
                            },
                        ],
                    },
                },
            ],
        };
        fs.writeFileSync(dumpPath, JSON.stringify(fixture), "utf8");

        const data = await getVnstatData(iface);

        expect(data.hour).to.have.length(1);
        expect(data.day).to.have.length(1);
        expect(data.month).to.have.length(1);
        expect(data.top).to.have.length(1);

        expect(data.hour[0].rx).to.equal(3600);
        expect(data.hour[0].tx).to.equal(1800);
        expect(data.day[0].rx).to.equal(86400);
        expect(data.month[0].tx).to.equal(86400);
        expect(data.top[0].tx).to.equal(2000);
        expect(data.summary.totalrx).to.equal(100000);
        expect(data.summary.totaltx).to.equal(200000);
        expect(data.summary.interface).to.equal(iface);
    });

    it("should parse jsonversion=1 dump (values in KiB)", async () => {
        const iface = "testiface-v1";
        const dumpPath = path.join(dumpsDir, `vnstat_dump_${iface}`);
        const fixture = {
            vnstatversion: "1.11",
            jsonversion: "1",
            interfaces: [
                {
                    name: iface,
                    created: {
                        date: { year: 2020, month: 6, day: 15 },
                        time: { hour: 0, minute: 0 },
                    },
                    updated: {
                        date: { year: 2020, month: 6, day: 16 },
                        time: { hour: 1, minute: 0 },
                    },
                    traffic: {
                        total: { rx: 1234, tx: 4321 },
                        fiveminute: [],
                        hours: [
                            {
                                id: 1,
                                date: { year: 2020, month: 6, day: 16 },
                                rx: 60,
                                tx: 30,
                            },
                        ],
                        days: [
                            {
                                id: 1,
                                date: { year: 2020, month: 6, day: 16 },
                                rx: 1024,
                                tx: 2048,
                            },
                        ],
                        months: [
                            {
                                id: 1,
                                date: { year: 2020, month: 6 },
                                rx: 4096,
                                tx: 8192,
                            },
                        ],
                        tops: [
                            {
                                id: 1,
                                date: { year: 2020, month: 5, day: 1 },
                                rx: 2048,
                                tx: 1024,
                            },
                        ],
                    },
                },
            ],
        };
        fs.writeFileSync(dumpPath, JSON.stringify(fixture), "utf8");

        const data = await getVnstatData(iface);

        expect(data.hour[0].rx).to.equal(60 * 1024);
        expect(data.day[0].tx).to.equal(2048 * 1024);
        expect(data.month[0].rx).to.equal(4096 * 1024);
        expect(data.top[0].tx).to.equal(1024 * 1024);
        expect(data.summary.totalrx).to.equal(1234 * 1024);
    });

    // A4: diffTime=0 — hour entry timestamp in the future should not produce Infinity in avg values
    it("should produce finite avg values when hour entry is timestamped in the future", async () => {
        const iface = "testiface-future";
        const dumpPath = path.join(dumpsDir, `vnstat_dump_${iface}`);
        const now = new Date();
        const futureHour = (now.getHours() + 2) % 24;
        const fixture = {
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
                        total: { rx: 100000, tx: 50000 },
                        fiveminute: [],
                        hour: [{
                            id: 0,
                            date: { year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() },
                            time: { hour: futureHour, minute: 0 },
                            rx: 3600,
                            tx: 1800,
                        }],
                        day: [{ id: 0, date: { year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() }, rx: 86400, tx: 43200 }],
                        month: [{ id: 0, date: { year: now.getFullYear(), month: now.getMonth() + 1 }, rx: 172800, tx: 86400 }],
                        top: [],
                    },
                },
            ],
        };
        fs.writeFileSync(dumpPath, JSON.stringify(fixture), "utf8");
        const data = await getVnstatData(iface);
        // avg values should be finite numbers, not Infinity or NaN
        for (const entry of data.hour) {
            expect(isFinite(entry.rx_avg)).to.equal(true, `rx_avg is not finite: ${entry.rx_avg}`);
            expect(isFinite(entry.tx_avg)).to.equal(true, `tx_avg is not finite: ${entry.tx_avg}`);
        }
    });
});
