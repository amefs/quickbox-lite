// SPDX-License-Identifier: GPL-3.0-or-later

import "mocha";
import { expect } from "chai";
import request from "supertest";

import { app } from "../../src/server";

describe("controllers/debug", () => {
    it("should return the debug page shell", async () => {
        const res = await request(app).get("/debug");

        expect(res.status).to.equal(200);
        expect(res.text).to.include("<html");
        expect(res.text).to.include("Debug Console");
    });

    it("should validate missing or empty debug node url", async () => {
        const missing = await request(app).get("/debug/node");
        const empty = await request(app).get("/debug/node?url=");

        expect(missing.status).to.equal(400);
        expect(empty.status).to.equal(400);
    });

    it("should resolve valid widget urls", async () => {
        const res = await request(app).get("/debug/node?url=/node/up");

        expect(res.status).to.equal(200);
    });
});
