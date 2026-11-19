// SPDX-License-Identifier: GPL-3.0-or-later

import "mocha";
import { expect } from "chai";

import { packageManagementCenter } from "../../src/widgets/package-management-center";

describe("widgets/package-management-center", () => {
    it("should render the package management panel", async () => {
        const result = await packageManagementCenter();

        expect(result).to.include("panel-server-package-management");
        expect(result).to.include("PACKAGE_MANAGEMENT_CENTER");
        expect(result).to.include("PMC_NOTICE_TXT");
    });

    it("should include package rows", async () => {
        const result = await packageManagementCenter();

        expect(result).to.include("<table");
        expect(result).to.include("AutoDL-iRSSi");
        expect(result).to.include("INSTALL");
    });

    it("should include package description keys", async () => {
        const result = await packageManagementCenter();

        expect(result).to.include("FILEBROWSER");
    });
});
