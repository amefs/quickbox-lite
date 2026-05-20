// SPDX-License-Identifier: GPL-3.0-or-later
// Unit tests for the dashboardMenu() widget.

import "mocha";
import { expect } from "chai";

import { dashboardMenu } from "../../src/widgets/menu";

describe("widgets/menu", () => {
    describe("dashboardMenu()", () => {
        it("should return an object with mainMenuHtml and showPluginTab", async () => {
            const result = await dashboardMenu();

            expect(result).to.be.an("object");
            expect(result).to.have.property("mainMenuHtml").that.is.a("string");
            expect(result).to.have.property("showPluginTab").that.is.a("boolean");
        });

        it("should return showPluginTab as false when rutorrent is not installed", async () => {
            // No lock files exist in the test environment
            const { showPluginTab } = await dashboardMenu();
            expect(showPluginTab).to.equal(false);
        });

        it("mainMenuHtml should be a string (even when no packages are installed)", async () => {
            const { mainMenuHtml } = await dashboardMenu();
            // React renderToString of an empty fragment returns an empty string
            expect(mainMenuHtml).to.be.a("string");
        });

        it("should not contain $username$ placeholders in any rendered output", async () => {
            const { mainMenuHtml } = await dashboardMenu();
            expect(mainMenuHtml).to.not.include("$username$");
        });

        it("should resolve consistently across multiple calls", async () => {
            const [first, second] = await Promise.all([dashboardMenu(), dashboardMenu()]);
            expect(first.showPluginTab).to.equal(second.showPluginTab);
            expect(first.mainMenuHtml).to.equal(second.mainMenuHtml);
        });
    });
});
