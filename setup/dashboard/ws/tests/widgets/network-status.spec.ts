// SPDX-License-Identifier: GPL-3.0-or-later
/* eslint-disable camelcase */

import "mocha";
import { expect } from "chai";
import * as sinon from "sinon";
import si from "systeminformation";

import { netStatus } from "../../src/widgets/network-status";

describe("widgets/network-status", () => {
    let networkInterfacesStub: sinon.SinonStub;
    let networkStatsStub: sinon.SinonStub;

    beforeEach(() => {
        networkInterfacesStub = sinon.stub(si, "networkInterfaces");
        networkStatsStub = sinon.stub(si, "networkStats");
        sinon.useFakeTimers(1700000000000);
    });

    afterEach(() => {
        sinon.restore();
    });

    it("should return network stats for active interfaces", async () => {
        networkInterfacesStub.resolves([
            { iface: "eth0", operstate: "up" },
            { iface: "lo", operstate: "down" },
        ]);
        networkStatsStub.withArgs("eth0").resolves([{
            rx_bytes: 123456,
            tx_bytes: 789012,
        }]);

        const result = await netStatus();
        expect(result.net).to.have.property("eth0");
        expect(result.net["eth0"].rx_bytes).to.equal(123456);
        expect(result.net["eth0"].tx_bytes).to.equal(789012);
        expect(result.ts).to.be.a("number");
    });

    it("should return empty object when no interfaces are up", async () => {
        networkInterfacesStub.resolves([
            { iface: "lo", operstate: "down" },
        ]);

        const result = await netStatus();
        expect(result.net).to.deep.equal({});
        expect(result.ts).to.equal(1700000000);
    });

    it("should handle multiple active interfaces", async () => {
        networkInterfacesStub.resolves([
            { iface: "eth0", operstate: "up" },
            { iface: "wlan0", operstate: "up" },
        ]);
        networkStatsStub.withArgs("eth0").resolves([{ rx_bytes: 100, tx_bytes: 200 }]);
        networkStatsStub.withArgs("wlan0").resolves([{ rx_bytes: 300, tx_bytes: 400 }]);

        const result = await netStatus();
        expect(Object.keys(result.net)).to.have.length(2);
        expect(result.net["eth0"].rx_bytes).to.equal(100);
        expect(result.net["wlan0"].tx_bytes).to.equal(400);
    });

    it("should skip interfaces with empty stats", async () => {
        networkInterfacesStub.resolves([
            { iface: "eth0", operstate: "up" },
        ]);
        networkStatsStub.withArgs("eth0").resolves([]);

        const result = await netStatus();
        expect(result.net).to.not.have.property("eth0");
    });

    it("should return timestamp as seconds since epoch", async () => {
        networkInterfacesStub.resolves([]);

        const result = await netStatus();
        expect(result.ts).to.equal(1700000000);
    });

    it("should include interfaces in unknown state and skip loopback", async () => {
        networkInterfacesStub.resolves([
            { iface: "eth0", operstate: "unknown" },
            { iface: "lo", operstate: "up" },
        ]);
        networkStatsStub.withArgs("eth0").resolves([{ rx_bytes: 11, tx_bytes: 22 }]);

        const result = await netStatus();
        expect(result.net).to.have.property("eth0");
        expect(result.net).to.not.have.property("lo");
    });

    it("should continue when one interface stats query fails", async () => {
        networkInterfacesStub.resolves([
            { iface: "eth0", operstate: "up" },
            { iface: "wlan0", operstate: "up" },
        ]);
        networkStatsStub.withArgs("eth0").rejects(new Error("stats failed"));
        networkStatsStub.withArgs("wlan0").resolves([{ rx_bytes: 300, tx_bytes: 400 }]);

        const result = await netStatus();
        expect(result.net).to.not.have.property("eth0");
        expect(result.net).to.have.property("wlan0");
    });
});
