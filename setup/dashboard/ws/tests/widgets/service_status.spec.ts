// SPDX-License-Identifier: GPL-3.0-or-later
/* eslint-disable @typescript-eslint/no-unused-expressions */

import "mocha";
import { expect } from "chai";

import { serviceStatus } from "../../src/widgets/service_status";

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
        // irssi is defined in packages.json but won't be running in test env
        const result = await serviceStatus("irssi");
        expect(result).to.be.a("string");
        expect(result).to.include("<span");
        // In test env, processes won't be running, so expect disabled
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
});
