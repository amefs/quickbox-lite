// SPDX-License-Identifier: GPL-3.0-or-later

import "mocha";
import { expect } from "chai";

import {
    baselineRates,
    fluctuateDisks,
    fluctuateLoad,
    fluctuateMemory,
    fluctuateVnstat,
    resetFluctuation,
    trafficCounters,
} from "../../mock/fluctuation";
import { MOCK_HOST, allRunning } from "../../mock/data/profiles";

interface VnstatSnapshot {
    interfaces: {
        traffic: {
            total: { rx: number; tx: number };
            hour: { rx: number; tx: number }[];
            day: { rx: number; tx: number }[];
            month: { rx: number; tx: number }[];
        };
    }[];
}

describe("fixture fluctuation", () => {
    afterEach(resetFluctuation);

    it("keeps the memory figures consistent", () => {
        const memory = fluctuateMemory(allRunning.memory, Date.now() + 45_000);

        expect(memory.used + memory.free).to.equal(memory.total);
        expect(memory.available).to.be.at.most(memory.total);
        expect(memory.buffers + memory.cached).to.equal(memory.buffcache);
        expect(memory.swapused + memory.swapfree).to.equal(memory.swaptotal);
    });

    it("moves the used memory ratio over time", () => {
        const early = fluctuateMemory(allRunning.memory, Date.now());
        const later = fluctuateMemory(allRunning.memory, Date.now() + 40_000);

        expect(later.used).to.not.equal(early.used);
    });

    it("keeps load averages inside the configured swing", () => {
        const [one, five, fifteen] = fluctuateLoad(allRunning.loadavg, Date.now() + 12_000);

        expect(one).to.be.within(1.52 * 0.55, 1.52 * 1.45);
        expect(five).to.be.within(1.34 * 0.7, 1.34 * 1.3);
        expect(fifteen).to.be.within(1.21 * 0.82, 1.21 * 1.18);
    });

    it("recomputes disk percentages from the fluctuated usage", () => {
        const disks = fluctuateDisks(allRunning.disks, Date.now() + 90_000);

        for (const disk of disks) {
            expect(disk.used + disk.available).to.equal(disk.size);
            expect(disk.use).to.be.closeTo((disk.used / disk.size) * 100, 0.01);
        }
    });

    it("advances byte counters by the elapsed time", () => {
        const start = Date.now();
        const base = { rx: 1000, tx: 500 };
        const rates = { rx: 100 * 1024, tx: 40 * 1024 };

        const first = trafficCounters("spec:counter", base, rates, start);
        expect(first.total).to.deep.equal(base);
        expect(first.delta).to.deep.equal({ rx: 0, tx: 0 });

        const second = trafficCounters("spec:counter", base, rates, start + 10_000);
        expect(second.delta.rx).to.be.closeTo(100 * 1024 * 10, 2);
        expect(second.delta.tx).to.be.closeTo(40 * 1024 * 10, 2);
        expect(second.total.rx).to.be.greaterThan(first.total.rx);
    });

    it("grows the vnstat buckets on every read", () => {
        const snapshot: VnstatSnapshot = {
            interfaces: [{
                traffic: {
                    total: { rx: 100, tx: 50 },
                    hour: [{ rx: 10, tx: 5 }],
                    day: [{ rx: 20, tx: 10 }],
                    month: [{ rx: 30, tx: 15 }],
                },
            }],
        };
        const json = JSON.stringify(snapshot);
        const start = Date.now();

        fluctuateVnstat(json, "spec:vnstat", { rx: 1024, tx: 512 }, start);
        const grown = JSON.parse(
            fluctuateVnstat(json, "spec:vnstat", { rx: 1024, tx: 512 }, start + 10_000),
        ) as VnstatSnapshot;
        const traffic = grown.interfaces[0].traffic;

        expect(traffic.total.rx).to.be.greaterThan(100);
        expect(traffic.hour[0].rx).to.be.greaterThan(10);
        expect(traffic.day[0].tx).to.be.greaterThan(10);
        expect(traffic.month[0].rx).to.be.greaterThan(30);
    });

    it("falls back to the host rate when a profile has none", () => {
        const rates = baselineRates({ ...allRunning, rxPerSecond: undefined, txPerSecond: undefined });

        expect(rates).to.deep.equal({ rx: MOCK_HOST.rxPerSecond, tx: MOCK_HOST.txPerSecond });
    });
});
