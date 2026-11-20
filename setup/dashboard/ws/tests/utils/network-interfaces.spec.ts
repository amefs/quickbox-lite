// SPDX-License-Identifier: GPL-3.0-or-later

import "mocha";
import { expect } from "chai";

import {
    isActiveNetworkInterface,
    listActiveInterfaceNames,
    type NetworkInterfaceInfo,
} from "../../src/utils/network-interfaces";

describe("utils/network-interfaces", () => {
    it("should exclude loopback interfaces on Linux and macOS", () => {
        expect(isActiveNetworkInterface({ iface: "lo", operstate: "up" }, "linux")).to.equal(false);
        expect(isActiveNetworkInterface({ iface: "lo0", operstate: "up" }, "darwin")).to.equal(false);
    });

    it("should exclude interfaces marked as internal or down", () => {
        expect(isActiveNetworkInterface({ iface: "en0", internal: true }, "darwin")).to.equal(false);
        expect(isActiveNetworkInterface({ iface: "en0", operstate: "down" }, "darwin")).to.equal(false);
    });

    it("should keep interfaces in unknown or dormant states", () => {
        expect(isActiveNetworkInterface({ iface: "en0", operstate: "unknown" }, "darwin")).to.equal(true);
        expect(isActiveNetworkInterface({ iface: "en0", operstate: "dormant" }, "linux")).to.equal(true);
    });

    it("should normalize separators and case in operstate values", () => {
        const downStates = ["notpresent", "NOT PRESENT", "lower-layer-down", "lower_layer_down", "lower layer down"];

        for (const operstate of downStates) {
            expect(isActiveNetworkInterface({ iface: "eth0", operstate }, "linux"), operstate).to.equal(false);
        }
    });

    it("should hide known system-managed interface prefixes for each platform", () => {
        for (const iface of ["awdl0", "llw0", "utun3"]) {
            expect(isActiveNetworkInterface({ iface, operstate: "up" }, "darwin"), iface).to.equal(false);
        }

        for (const iface of ["docker0", "docker_gwbridge", "veth123", "br-123456", "virbr0", "cni0", "flannel.1", "cali123", "podman0"]) {
            expect(isActiveNetworkInterface({ iface, operstate: "up" }, "linux"), iface).to.equal(false);
        }
    });

    it("should preserve user interfaces that do not match system-managed prefixes", () => {
        for (const iface of ["eth0", "tun0", "tap0", "wg0", "tailscale0"]) {
            expect(isActiveNetworkInterface({ iface, operstate: "up" }, "linux"), iface).to.equal(true);
        }
    });

    it("should let explicitly monitored interfaces override only prefix filtering", () => {
        const monitoredInterfaces = new Set([" docker0 ", "utun3"]);

        expect(isActiveNetworkInterface({ iface: "docker0", operstate: "up" }, "linux", monitoredInterfaces)).to.equal(true);
        expect(isActiveNetworkInterface({ iface: "utun3", operstate: "up" }, "darwin", monitoredInterfaces)).to.equal(true);
        expect(isActiveNetworkInterface({ iface: "docker0", operstate: "down" }, "linux", monitoredInterfaces)).to.equal(false);
        expect(isActiveNetworkInterface({ iface: "docker0", internal: true }, "linux", monitoredInterfaces)).to.equal(false);
    });

    it("should treat interface names as case-sensitive when matching explicit monitoring", () => {
        expect(isActiveNetworkInterface({ iface: "docker0", operstate: "up" }, "linux", new Set(["DOCKER0"]))).to.equal(false);
    });

    it("should trim interface names and return unique active names", () => {
        const interfaces: NetworkInterfaceInfo[] = [
            { iface: " eth0 ", operstate: "up" },
            { iface: "eth0", operstate: "unknown" },
            { iface: " lo0 ", operstate: "up" },
        ];

        expect(listActiveInterfaceNames(interfaces, "darwin")).to.deep.equal(["eth0"]);
    });

    it("should not apply platform-specific prefix filtering on other platforms", () => {
        expect(isActiveNetworkInterface({ iface: "docker0", operstate: "up" }, "freebsd")).to.equal(true);
    });
});
