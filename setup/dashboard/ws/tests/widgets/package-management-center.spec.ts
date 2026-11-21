// SPDX-License-Identifier: GPL-3.0-or-later

import "mocha";
import { expect } from "chai";

import { getPackageManagementData, getPackageManagementStateData } from "../../src/services/packages/pmc";

describe("widgets/package-management-center", () => {
    it("should return package rows with i18n keys and no HTML fields", () => {
        const result = getPackageManagementData();

        expect(result).to.have.property("rows").that.is.an("array");
        expect(result).to.have.property("installLockExists").that.is.a("boolean");
        const autodl = result.rows.find((row) => row.name === "AutoDL-iRSSi");
        expect(autodl).to.be.an("object");
        const filebrowser = result.rows.find((row) => row.descriptionKey === "FILEBROWSER");
        expect(filebrowser).to.be.an("object");
    });

    it("should return compact installed state map for polling", () => {
        const state = getPackageManagementStateData();

        expect(state).to.have.property("installedByPackage").that.is.an("object");
        expect(state).to.have.property("installLockExists").that.is.a("boolean");
    });
});
