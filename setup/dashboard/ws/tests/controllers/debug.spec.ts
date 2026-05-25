// SPDX-License-Identifier: GPL-3.0-or-later

import "mocha";
import { expect } from "chai";
import request from "supertest";

import { app } from "../../src/server";

describe("controllers/debug", () => {
    it("should return the debug page", async () => {
        const res = await request(app).get("/debug");

        expect(res.status).to.equal(200);
        expect(res.text).to.include("<html");
    });

    it("should validate debug node url param", async () => {
        const missing = await request(app).get("/debug/node");
        const empty = await request(app).get("/debug/node?url=");

        expect(missing.status).to.equal(400);
        expect(empty.status).to.equal(400);
    });

    it("should resolve valid widget urls", async () => {
        const res = await request(app).get("/debug/node?url=/node/up.php");

        expect(res.status).to.equal(200);
    });
});
