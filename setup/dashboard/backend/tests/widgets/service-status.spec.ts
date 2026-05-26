// SPDX-License-Identifier: GPL-3.0-or-later
/* eslint-disable @typescript-eslint/no-unused-expressions */

import "mocha";
import { expect } from "chai";

import { serviceStatus, serviceStatusAll } from "../../src/widgets/service-status";
import { processExistsIn, systemdUnitActive } from "../../src/utils/helpers";

describe("widgets/service-status", () => {
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

        it("should use systemd check for FlexGet", async () => {
            // eslint-disable-next-line @typescript-eslint/require-await
            const mockSystemd = async (unit: string) => {
                expect(unit).to.match(/^flexget@/);
                expect(unit).to.not.include("$username$");
                return true;
            };
            const result = await serviceStatus("flexget", processExistsIn as never, mockSystemd);
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

    describe("systemd state", () => {
        it("should use systemd check for services with systemdUnit", async () => {
            // eslint-disable-next-line @typescript-eslint/require-await
            const mockSystemd = async (unit: string) => {
                expect(unit).to.equal("denyhosts");
                return true;
            };
            const result = await serviceStatus("denyhosts", processExistsIn as never, mockSystemd);
            expect(result).to.include("badge-service-running");
        });

        it("should skip process check when systemdUnit is set", async () => {
            let processCalled = false;
            // eslint-disable-next-line @typescript-eslint/require-await
            const checkProcess = async () => { processCalled = true; return true; };
            // eslint-disable-next-line @typescript-eslint/require-await
            const checkSystemd = async () => false;
            await serviceStatus("denyhosts", checkProcess, checkSystemd);
            expect(processCalled).to.equal(false);
        });

        it("should handle serviceStatusAll with mixed systemd and process services", async () => {
            // eslint-disable-next-line @typescript-eslint/require-await
            const alwaysActive = async () => true;
            const result = await serviceStatusAll(alwaysActive);
            // systemd-backed services should now appear as running
            expect(result).to.have.property("denyhosts");
            expect(result.denyhosts).to.include("badge-service-running");
            // process-backed services are not running in test env
            expect(result).to.have.property("irssi");
        });

        it("should default systemdUnitActive gracefully on non-systemd host", async () => {
            // Verifies the default export does not throw when systemctl is unavailable
            const result = await systemdUnitActive("nonexistent.service");
            expect(result).to.equal(false);
        });

        it("should expand $username$ in systemdUnit for per-user services like peerbanhelper", async () => {
            const seenUnits: string[] = [];
            // eslint-disable-next-line @typescript-eslint/require-await
            const captureSystemd = async (unit: string) => { seenUnits.push(unit); return false; };
            await serviceStatus("peerbanhelper", processExistsIn as never, captureSystemd);
            expect(seenUnits).to.have.length(1);
            // $username$ must have been substituted — literal placeholder must not remain
            expect(seenUnits[0]).to.not.include("$username$");
            expect(seenUnits[0]).to.match(/^peerbanhelper@/);
        });
    });
});
