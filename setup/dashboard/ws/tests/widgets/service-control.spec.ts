// SPDX-License-Identifier: GPL-3.0-or-later

import "mocha";
import { expect } from "chai";

import { serviceControl } from "../../src/widgets/service-control";

describe("widgets/service-control", () => {
    it("should render the service control panel", async () => {
        const result = await serviceControl();

        expect(result).to.include("panel-server-service-control");
        expect(result).to.include("SERVICE_CONTROL_CENTER");
    });

    it("should render a table shell even when no services are installed", async () => {
        const result = await serviceControl();

        expect(result).to.include("<table");
        expect(result).to.include("SERVICE_STATUS");
        expect(result).to.include("ENABLE_DISABLE_SERVICES");
    });
});
