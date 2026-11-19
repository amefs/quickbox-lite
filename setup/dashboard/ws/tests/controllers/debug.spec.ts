// SPDX-License-Identifier: GPL-3.0-or-later

import "mocha";
import { expect } from "chai";
import request from "supertest";

import { app } from "../../src/server";
import type { DebugMetaPayload } from "../../src/shared/bootstrap-contract";

describe("controllers/debug", () => {
    it("should return the SPA shell on /debug", async () => {
        const res = await request(app).get("/debug");

        expect(res.status).to.equal(200);
        expect(res.text).to.include("<html");
        expect(res.text).to.include('id="root"');
    });

    it("should return debug metadata JSON on /debug/meta", async () => {
        const res = await request(app).get("/debug/meta");
        const body = res.body as DebugMetaPayload;

        expect(res.status).to.equal(200);
        expect(body.basePath).to.equal("");
        expect(["defaulted", "smoked"]).to.include(body.theme);
        expect(body.endpoints).to.be.an("array");
        expect(body.endpoints.length).to.be.greaterThan(0);
        expect(body.packages).to.be.an("array");
    });

    it("should validate missing or empty debug node url", async () => {
        const missing = await request(app).get("/debug/node");
        const empty = await request(app).get("/debug/node?url=");

        expect(missing.status).to.equal(400);
        expect(empty.status).to.equal(400);
    });

    it("should resolve valid widget urls", async () => {
        const res = await request(app).get("/debug/node?url=/node/data/system_uptime");

        expect(res.status).to.equal(200);
    });
});
