// SPDX-License-Identifier: GPL-3.0-or-later
/* eslint-disable @typescript-eslint/no-unused-expressions */

import "mocha";
import { expect } from "chai";

import { serviceStatus, serviceStatusAll } from "../../src/widgets/service_status";

describe("widgets/service_status", () => {
    it("should render disabled badge when service is undefined", async () => {
        const result = await serviceStatus(undefined);
        expect(result).to.include("badge-service-disabled-dot");
        expect(result).to.include("badge-service-disabled-pulse");
    });

    it("should render disabled badge when service is not found in serviceMap", async () => {
        const result = await serviceStatus("nonexistent-service-xyz-123");
        expect(result).to.include("badge-service-disabled-dot");
        expect(result).to.include("badge-service-disabled-pulse");
    });

    it("should return valid HTML with span elements", async () => {
        const result = await serviceStatus(undefined);
        expect(result).to.include("<span");
        expect(result).to.include("</span>");
    });

    it("should return valid HTML for known service (non-running)", async () => {
        // eslint-disable-next-line @typescript-eslint/require-await
        const alwaysNotRunning = async () => false;
        const result = await serviceStatus("irssi", alwaysNotRunning);
        expect(result).to.be.a("string");
        expect(result).to.include("<span");
        expect(result).to.include("badge-service-disabled");
    });

    it("should render badge classes for both dot and pulse", async () => {
        const result = await serviceStatus(undefined);
        // Should have both dot and pulse badge variants
        const dotMatch = result.match(/badge-service-\w+-dot/);
        const pulseMatch = result.match(/badge-service-\w+-pulse/);
        expect(dotMatch).to.not.be.null;
        expect(pulseMatch).to.not.be.null;
    });

    describe("running state", () => {
        // eslint-disable-next-line @typescript-eslint/require-await
        const alwaysRunning = async () => true;

        it("should render running badge when processExists returns true", async () => {
            // irssi is in serviceMap; with alwaysRunning mock it will appear as running
            const result = await serviceStatus("irssi", alwaysRunning);
            expect(result).to.include("badge-service-running-dot");
            expect(result).to.include("badge-service-running-pulse");
            expect(result).to.not.include("badge-service-disabled");
        });

        it("should render running badge for any known service when process is found", async () => {
            const result = await serviceStatus("qbittorrent", alwaysRunning);
            expect(result).to.include("badge-service-running");
        });
    });

    describe("batch state", () => {
        it("should return a keyed service badge map", async () => {
            const result = await serviceStatusAll();

            expect(result).to.be.an("object");
            expect(result).to.have.property("irssi");
            expect(result.irssi).to.include("badge-service-");
        });
    });
});
