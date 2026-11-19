// SPDX-License-Identifier: GPL-3.0-or-later

import "mocha";
import { expect } from "chai";

import { resolveDashboardMenuState } from "../../src/services/packages/menu";

describe("widgets/menu", () => {
    describe("resolveDashboardMenuState()", () => {
        it("should return structured menu state and plugin-tab visibility", async () => {
            const result = await resolveDashboardMenuState();

            expect(result).to.be.an("object");
            expect(result).to.have.property("installedMenuEntries").that.is.an("array");
            expect(result).to.have.property("installedDownloadEntries").that.is.an("array");
            expect(result).to.have.property("showPluginTab").that.is.a("boolean");
            expect(result).to.have.property("showWebConsole").that.is.a("boolean");
        });

        it("should return showPluginTab as false when rutorrent is not installed", async () => {
            const { showPluginTab } = await resolveDashboardMenuState();
            expect(showPluginTab).to.equal(false);
        });

        it("should resolve consistently across multiple calls", async () => {
            const [first, second] = await Promise.all([resolveDashboardMenuState(), resolveDashboardMenuState()]);
            expect(first).to.deep.equal(second);
        });
    });
});
