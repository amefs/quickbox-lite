// SPDX-License-Identifier: GPL-3.0-or-later

import "mocha";
import { expect } from "chai";
import request from "supertest";

import { app } from "../../src/server";

describe("controllers/dashboard", () => {
    it("should render dashboard chrome and embedded client behavior", async () => {
        const res = await request(app).get("/");

        expect(res.status).to.equal(200);
        expect(res.text).to.include("id=\"service_control_widget\"");
        expect(res.text).to.include("quickbox:locale");
        expect(res.text).to.include("window.serviceUpdateHandler");
        expect(res.text).to.include("startStatusUpdates");
        expect(res.text).to.include("request.locale = window.quickboxLocale");
        expect(res.text).to.include("id=\"bw_tables_loading\"");
        expect(res.text).to.include("box fix dpkg");
        expect(res.text).to.include("autodlirssiRemovalConfirm");
        expect(res.text).to.include('data-click-handler="packageRemove"');
        expect(res.text).to.include("/lib/datatables/js/jquery.dataTables.min.js");
        expect(res.text).to.include("/lib/perfect-scrollbar/js/perfect-scrollbar.min.js");
        expect(res.text).to.include("new window.PerfectScrollbar(element)");
        expect(res.text).to.include("startOutputLogPolling");
        expect(res.text).to.include("fetchJson(buildOutputLogUrl())");
        expect(res.text).to.not.include('class="modal-body ps"');
        expect(res.text).to.not.include('key: "SSH_OUTPUT"');
        expect(res.text).to.not.include('fetchJson("/node/menu")');
        expect(res.text).to.not.include('fetchText("/node/removal_modals")');
        expect(res.text).to.not.include("panel.app_status.ws.js");
        expect(res.text).to.not.include("panel.app_service.ws.js");
    });

    it("should render with request-local locale", async () => {
        const zh = await request(app).get("/?locale=zh");
        const en = await request(app).get("/?locale=en");

        expect(zh.status).to.equal(200);
        expect(en.status).to.equal(200);
        expect(zh.text).to.include("<html lang=\"zh\">");
        expect(zh.text).to.include("window.quickboxLocale = normalizeLocale(\"zh\")");
        expect(zh.text).to.include("\"enabled\":\"已启用\"");
        expect(zh.text).to.include("\"disabled\":\"禁用\"");
        expect(zh.text).to.include("服务控制中心");
        expect(zh.text).to.include("关闭 &amp; 刷新");
        expect(zh.text).to.not.include("关闭 &amp;amp; 刷新");
        expect(zh.text).to.include("切换到 <code>development</code> 分支");
        expect(zh.text).to.not.include("切换到 &lt;code&gt;development&lt;/code&gt; 分支");
        expect(en.text).to.include("Service Control Center");
        expect(en.text).to.include("Close &amp; Refresh");
        expect(en.text).to.not.include("Close &amp;amp; Refresh");
        expect(en.text).to.include("Switch to <code>development</code>");
        expect(en.text).to.not.include("Switch to &lt;code&gt;development&lt;/code&gt;");
    });

    it("should render from browser locale cookie", async () => {
        const res = await request(app)
            .get("/")
            .set("Cookie", "quickbox_locale=zh");

        expect(res.status).to.equal(200);
        expect(res.text).to.include("<html lang=\"zh\">");
        expect(res.text).to.include("window.quickboxLocale = normalizeLocale(\"zh\")");
        expect(res.text).to.include("服务控制中心");
    });

    it("should render from Accept-Language when no explicit locale is set", async () => {
        const res = await request(app)
            .get("/")
            .set("Accept-Language", "fr-FR,fr;q=0.9,en;q=0.1");

        expect(res.status).to.equal(200);
        expect(res.text).to.include("<html lang=\"fr\">");
        expect(res.text).to.include("window.quickboxLocale = normalizeLocale(\"fr\")");
        expect(res.text).to.include("Centre de contrôle des services");
    });

    it("should render from a browser locale region without a base fallback", async () => {
        const res = await request(app)
            .get("/")
            .set("Accept-Language", "de-DE");

        expect(res.status).to.equal(200);
        expect(res.text).to.include("<html lang=\"de\">");
        expect(res.text).to.include("window.quickboxLocale = normalizeLocale(\"de\")");
        expect(res.text).to.include("Dienst Kontrollcenter");
    });
});
