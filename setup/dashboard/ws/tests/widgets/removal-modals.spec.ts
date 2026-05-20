// SPDX-License-Identifier: GPL-3.0-or-later
// Unit tests for the removalModals() widget.

import "mocha";
import { expect } from "chai";

import { removalModals } from "../../src/widgets/removal-modals";

describe("widgets/removal-modals", () => {
    describe("removalModals()", () => {
        it("should return a string", async () => {
            const result = await removalModals();
            expect(result).to.be.a("string");
        });

        it("should include RemovalConfirm modal ids for non-boxonly packages", async () => {
            const result = await removalModals();
            // autodlirssi is boxonly=false and has an uninstall key
            expect(result).to.include("autodlirssiRemovalConfirm");
        });

        it("should set data-click-handler='packageRemove' on each confirm button", async () => {
            const result = await removalModals();
            expect(result).to.include('data-click-handler="packageRemove"');
        });

        it("should include data-package and data-package-name attributes on confirm buttons", async () => {
            const result = await removalModals();
            expect(result).to.include('data-package="autodlirssi"');
            expect(result).to.include('data-package-name="AutoDL-iRSSi"');
        });

        it("should include btn-primary class on confirm buttons", async () => {
            const result = await removalModals();
            expect(result).to.include("btn btn-primary");
        });

        it("should NOT include boxonly packages (e.g. autoremovetorrents / denyhosts)", async () => {
            const result = await removalModals();
            // autoremovetorrents and denyhosts have boxonly:true so no modal should be generated
            expect(result).to.not.include("autoremovetorrentsRemovalConfirm");
            expect(result).to.not.include("denyHostsRemovalConfirm");
        });

        it("should include multiple modal blocks", async () => {
            const result = await removalModals();
            // Count RemovalConfirm occurrences as a proxy for modal count
            const matches = result.match(/RemovalConfirm/g) ?? [];
            // At least 5 non-boxonly packages with uninstall keys exist in packages.json
            expect(matches.length).to.be.greaterThan(4);
        });

        it("should include role='dialog' on each modal wrapper", async () => {
            const result = await removalModals();
            expect(result).to.include('role="dialog"');
        });
    });
});
