// SPDX-License-Identifier: GPL-3.0-or-later

import "mocha";
import { expect } from "chai";
import request from "supertest";

// NODE_ENV=test is set by the test script, so server.listen() is skipped
import { app } from "../src/server";

describe("server routes", () => {
    describe("GET /", () => {
        it("should return 200 with HTML", async () => {
            const res = await request(app).get("/");
            expect(res.status).to.equal(200);
            expect(res.text).to.include("<html");
        });
    });

    describe("GET /set (locale update)", () => {
        it("should return 200 for localhost requests", async () => {
            // supertest binds loopback, so no X-Forwarded-For → req.ip = 127.0.0.1
            const res = await request(app).get("/set?lang=en");
            expect(res.status).to.equal(200);
            expect(res.text).to.equal("en");
        });

        it("should return 403 for non-localhost requests (via X-Forwarded-For)", async () => {
            // app.set("trust proxy", true) causes x-forwarded-for to override req.ip
            const res = await request(app)
                .get("/set?lang=en")
                .set("X-Forwarded-For", "203.0.113.1");
            expect(res.status).to.equal(403);
        });

        it("should set locale to 'zh' and return it", async () => {
            const res = await request(app).get("/set?lang=zh");
            expect(res.status).to.equal(200);
            expect(res.text).to.equal("zh");
        });

        it("should default to 'en' for missing lang param", async () => {
            const res = await request(app).get("/set");
            expect(res.status).to.equal(200);
            expect(res.text).to.equal("en");
        });
    });

    describe("GET /debug (available when NODE_ENV !== production)", () => {
        // NODE_ENV=test → debug routes are registered (test !== production)
        it("should return 200 for /debug page", async () => {
            const res = await request(app).get("/debug");
            expect(res.status).to.equal(200);
            expect(res.text).to.include("<html");
        });

        it("should return 400 for /debug/node without url param", async () => {
            const res = await request(app).get("/debug/node");
            expect(res.status).to.equal(400);
        });

        it("should return 200 for /debug/node with valid url param", async () => {
            const res = await request(app).get("/debug/node?url=/node/up.php");
            expect(res.status).to.equal(200);
        });
    });
});
