// SPDX-License-Identifier: GPL-3.0-or-later

import "mocha";
import { expect } from "chai";
import { readFileSync } from "fs";
import path from "path";

describe("vendor bootstrap contract", () => {
    it("should expose jQuery only for npm UMD plugin registration", () => {
        const jquerySource = readFileSync(path.resolve(__dirname, "..", "src", "vendor", "jquery.ts"), "utf8");
        const vendorSource = readFileSync(path.resolve(__dirname, "..", "src", "vendor", "index.ts"), "utf8");

        expect(jquerySource).to.include("browserWindow.$ = $");
        expect(jquerySource).to.include("browserWindow.jQuery = $");
        expect(vendorSource).to.not.include("globalObj.io");
        expect(vendorSource).to.not.include("globalObj.AnsiUp");
        expect(vendorSource).to.not.include("globalObj.bootbox");
    });

    it("should import key jquery plugins in deterministic order", () => {
        const source = readFileSync(path.resolve(__dirname, "..", "src", "vendor", "index.ts"), "utf8");

        const orderedImports = [
            'import { $ } from "./jquery.js";',
            'await import("jquery-ui/dist/jquery-ui.js");',
            'await import("jquery-ui-touch-punch/jquery.ui.touch-punch.js");',
            'await import("bootstrap/dist/js/bootstrap.js");',
            'await import("datatables/media/js/jquery.dataTables.js");',
            'await import("select2/dist/js/select2.js");',
            'await import("lobipanel/js/lobipanel.js");',
            'await import("jquery-toggles/toggles.js");',
            'await import("gritter/js/jquery.gritter.js");',
        ];

        let previousIndex = -1;
        for (const statement of orderedImports) {
            const currentIndex = source.indexOf(statement);
            expect(currentIndex, statement).to.be.greaterThan(previousIndex);
            previousIndex = currentIndex;
        }
    });

    it("should initialize dashboard behavior from the frontend module entry", () => {
        const clientSource = readFileSync(path.resolve(__dirname, "..", "src", "client.ts"), "utf8");

        expect(clientSource).to.include("initializeQuickUi($)");
        expect(clientSource).to.include("initializeDashboardRuntime");
        expect(clientSource).to.not.include("/js/quick.js");
        expect(clientSource).to.not.include("/js/dashboard.js");
    });
});
