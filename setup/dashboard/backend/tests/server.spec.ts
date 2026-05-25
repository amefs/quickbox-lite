// SPDX-License-Identifier: GPL-3.0-or-later
// Server-level smoke tests — verifies the app instance is exported correctly.
// Full HTTP route coverage lives in router.spec.ts.

import "mocha";
import { expect } from "chai";

import { app } from "../src/server";

describe("server", () => {
    it("should export an Express application instance", () => {
        expect(app).to.be.a("function");
        // Express apps expose a 'listen' method on the underlying http server
        expect(app).to.have.property("get").that.is.a("function");
        expect(app).to.have.property("use").that.is.a("function");
    });

    it("should have 'trust proxy' set to 'loopback'", () => {
        // Trust-proxy must be loopback so that X-Forwarded-For from non-local
        // IPs causes /set to reject with 403.
        expect(app.get("trust proxy fn")).to.be.a("function");
    });
});

