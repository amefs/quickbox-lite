// SPDX-License-Identifier: GPL-3.0-or-later

import "mocha";
import { expect } from "chai";
import request from "supertest";

import { app } from "../../src/server";

describe("controllers/dashboard", () => {
    it("should render dashboard shell smoke contract", async () => {
        const res = await request(app).get("/");

        expect(res.status).to.equal(200);
        expect(res.text).to.include("<!DOCTYPE html>");
        expect(res.text).to.include("Quickbox Dashboard");
        expect(res.text).to.include("id=\"service_control_widget\"");
        expect(res.text).to.include("window.quickboxRuntime");
        expect(res.text).to.include("id=\"bw_tables_loading\"");
        expect(res.text).to.include('data-click-handler="packageRemove"');
    });

    it("should keep locale runtime in sync for query, cookie and accept-language", async () => {
        const byQuery = await request(app).get("/?locale=zh");
        const byCookie = await request(app).get("/").set("Cookie", "quickbox_locale=fr");
        const byHeader = await request(app).get("/").set("Accept-Language", "de-DE");

        expect(byQuery.status).to.equal(200);
        expect(byQuery.text).to.include("<html lang=\"zh\">");
        expect(byQuery.text).to.include('"locale":"zh"');

        expect(byCookie.status).to.equal(200);
        expect(byCookie.text).to.include("<html lang=\"fr\">");
        expect(byCookie.text).to.include('"locale":"fr"');

        expect(byHeader.status).to.equal(200);
        expect(byHeader.text).to.include("<html lang=\"de\">");
        expect(byHeader.text).to.include('"locale":"de"');
    });
});
