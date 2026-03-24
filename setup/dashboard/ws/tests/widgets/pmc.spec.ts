// SPDX-License-Identifier: GPL-3.0-or-later

import "mocha";
import { expect } from "chai";

import { packageManagementCenter } from "../../src/widgets/pmc";

describe("widgets/pmc", () => {
    it("should render the package management panel", async () => {
        const result = await packageManagementCenter();

        expect(result).to.include("panel-server-package-management");
        expect(result).to.include("Package Management Center");
        expect(result).to.include("Heads Up!");
    });

    it("should include package rows", async () => {
        const result = await packageManagementCenter();

        expect(result).to.include("<table");
        expect(result).to.include("AutoDL-iRSSi");
        expect(result).to.include("Install");
    });

    it("should render html in package details", async () => {
        const result = await packageManagementCenter();

        expect(result).to.include("https://hub.docker.com/r/80x86/filebrowser/");
        expect(result).to.include("<a href=");
    });
});
