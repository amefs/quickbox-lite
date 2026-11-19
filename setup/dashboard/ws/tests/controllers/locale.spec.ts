// SPDX-License-Identifier: GPL-3.0-or-later

import "mocha";
import { expect } from "chai";
import request from "supertest";

import { app } from "../../src/server";
import type { DashboardBootstrapPayload } from "../../src/shared/bootstrap-contract";

describe("controllers/locale", () => {
    it("should return normalized locale for a loopback request", async () => {
        const en = await request(app).get("/set?lang=en");
        const zh = await request(app).get("/set?lang=zh");
        const zhCn = await request(app).get("/set?lang=zh-CN");

        expect(en.status).to.equal(200);
        expect(en.text).to.equal("en");
        expect(zh.status).to.equal(200);
        expect(zh.text).to.equal("zh");
        expect(zhCn.status).to.equal(200);
        expect(zhCn.text).to.equal("zh");
    });

    it("should default to en when lang param is absent or malformed", async () => {
        const missing = await request(app).get("/set");
        const traversal = await request(app).get("/set?lang=../../etc/passwd");

        expect(missing.status).to.equal(200);
        expect(missing.text).to.equal("en");
        expect(traversal.status).to.equal(200);
        expect(traversal.text).to.equal("en");
    });

    it("should return 403 for non-localhost requests via X-Forwarded-For", async () => {
        const res = await request(app)
            .get("/set?lang=en")
            .set("X-Forwarded-For", "203.0.113.1");

        expect(res.status).to.equal(403);
    });

    it("should not mutate the dashboard bootstrap locale globally", async () => {
        await request(app).get("/set?lang=zh");
        const res = await request(app).get("/node/bootstrap");
        const body = res.body as DashboardBootstrapPayload;

        expect(res.status).to.equal(200);
        expect(body.locale).to.equal("en");
        expect(body.messages.title).to.equal("SERVICE_CONTROL_CENTER");
    });
});
