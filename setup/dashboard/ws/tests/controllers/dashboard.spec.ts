// SPDX-License-Identifier: GPL-3.0-or-later

import "mocha";
import { expect } from "chai";
import request from "supertest";

import { app } from "../../src/server";
import type { DashboardBootstrapPayload } from "../../src/shared/bootstrap-contract";

describe("controllers/dashboard", () => {
    it("should keep Basic-authenticated Apple browsers on polling without exposing credentials", async () => {
        const credentials = "Basic " + Buffer.from("fixture:private-fixture-password").toString("base64");
        const cases = [
            ["Mozilla/5.0 (iPhone) AppleWebKit/605.1.15 Version/26.0 Mobile Safari/604.1", true, false],
            ["Mozilla/5.0 (iPhone) AppleWebKit/605.1.15 CriOS/140.0 Mobile Safari/604.1", true, false],
            ["Mozilla/5.0 (Macintosh) AppleWebKit/605.1.15 Version/26.0 Safari/605.1.15", true, false],
            ["Mozilla/5.0 (Macintosh) AppleWebKit/537.36 Chrome/140.0 Safari/537.36", true, true],
            ["Mozilla/5.0 (iPhone) AppleWebKit/605.1.15 Mobile Safari/604.1", false, true],
        ] as const;
        for (const [agent, basic, upgrade] of cases) {
            const requestBuilder = request(app).get("/node/bootstrap").set("User-Agent", agent);
            if (basic) {
                requestBuilder.set("Authorization", credentials);
            } else {
                requestBuilder.set("Cookie", "authelia_session=fixture");
            }
            const res = await requestBuilder;
            const body = res.body as DashboardBootstrapPayload;
            expect(res.status).to.equal(200);
            expect(body.socketUpgrade).to.equal(upgrade);
            expect(res.text).not.to.include(credentials);
            expect(res.text).not.to.include("private-fixture-password");
        }
    });

    it("should serve the static SPA shell and bootstrap JSON contract", async () => {
        const htmlRes = await request(app).get("/");
        expect(htmlRes.status).to.equal(200);
        expect(htmlRes.text).to.include("<!DOCTYPE html>");
        expect(htmlRes.text).to.include("Quickbox Dashboard");
        expect(htmlRes.text).to.include('id="root"');
        expect(htmlRes.text).to.include("./assets/");

        const bootstrapRes = await request(app).get("/node/bootstrap");
        expect(bootstrapRes.status).to.equal(200);
        expect(bootstrapRes.body).to.be.an("object");
        expect(bootstrapRes.body).to.have.property("locales").that.is.an("array");
        expect(bootstrapRes.body).to.have.property("serviceKeys").that.is.an("array");
        expect(bootstrapRes.body).to.have.property("serviceRows").that.is.an("array");
        expect(bootstrapRes.body).to.have.property("packageManagement").that.is.an("object");
        expect(bootstrapRes.body).to.have.property("chrome").that.is.an("object");
        expect(bootstrapRes.body).to.have.property("systemSummary").that.is.an("object");
    });
});
