// SPDX-License-Identifier: GPL-3.0-or-later

import "mocha";
import { expect } from "chai";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "fs";
import os from "os";
import path from "path";

import { resolveDashboardClientBundle } from "../../src/utils/client-assets";

describe("utils/client-assets", () => {
    let dashboardDir: string;

    beforeEach(() => {
        dashboardDir = mkdtempSync(path.join(os.tmpdir(), "quickbox-client-assets-"));
        mkdirSync(path.join(dashboardDir, "js", "migration"), { recursive: true });
    });

    afterEach(() => {
        rmSync(dashboardDir, { recursive: true, force: true });
    });

    it("resolves a manifest bundle from the dashboard js directory", () => {
        const assetPath = "/js/migration/dashboard-client.abcdef12.js";
        writeFileSync(path.join(dashboardDir, "js", "migration", "dashboard-client.abcdef12.js"), "bundle");
        writeFileSync(path.join(dashboardDir, "js", "migration", "dashboard-client-manifest.json"), JSON.stringify({ version: 1, dashboardClient: assetPath }));

        expect(resolveDashboardClientBundle(dashboardDir)).to.equal(assetPath);
    });

    it("ignores missing bundles and malformed manifest paths", () => {
        const manifestPath = path.join(dashboardDir, "js", "migration", "dashboard-client-manifest.json");
        writeFileSync(manifestPath, JSON.stringify({ version: 1, dashboardClient: "/js/migration/dashboard-client.abcdef12.js" }));
        expect(resolveDashboardClientBundle(dashboardDir)).to.equal(undefined);

        writeFileSync(manifestPath, JSON.stringify({ version: 1, dashboardClient: "/js/../../package.json" }));
        expect(resolveDashboardClientBundle(dashboardDir)).to.equal(undefined);
    });
});
