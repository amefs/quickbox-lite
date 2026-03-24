// SPDX-License-Identifier: GPL-3.0-or-later

import "mocha";
import { expect } from "chai";

import { serviceControl } from "../../src/widgets/service_control";

describe("widgets/service_control", () => {
    it("should render the service control panel", async () => {
        const result = await serviceControl();

        expect(result).to.include("panel-server-service-control");
        expect(result).to.include("Service Control Center");
    });

    it("should render a table shell even when no services are installed", async () => {
        const result = await serviceControl();

        expect(result).to.include("<table");
        expect(result).to.include("Service Status");
        expect(result).to.include("Enable/Disable");
    });
});
