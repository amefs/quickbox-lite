// SPDX-License-Identifier: GPL-3.0-or-later

import "mocha";
import { expect } from "chai";
import request from "supertest";

import { app } from "../../src/server";
import { createControllerTestApp, createExecFileRecorder } from "./test-utils";

interface SystemStaticResponse {
    cpu: {
        modelHtml: string;
        count: unknown;
    };
    interfaces: string[];
}

interface PluginsResponse {
    plugins: {
        name: string;
        installed: boolean;
    }[];
}

interface DashboardConfigResponse {
    languages: {
        file: string;
        key: string;
        title: string;
        locale: string;
    }[];
}

describe("controllers/node", () => {
    it("should return menu HTML and plugin-tab visibility", async () => {
        const res = await request(app).get("/node/menu");

        expect(res.status).to.equal(200);
        expect(res.body).to.be.an("object");
        expect(res.body).to.have.property("mainMenuHtml").that.is.a("string");
        expect(res.body).to.have.property("showPluginTab").that.is.a("boolean");
        expect((res.body as { mainMenuHtml: string }).mainMenuHtml).to.not.include("$username$");
    });

    it("should return static dashboard config", async () => {
        const res = await request(app).get("/node/dashboard_config");

        expect(res.status).to.equal(200);
        expect(res.body).to.have.property("version", "v1.5.12");
        expect(res.body).to.have.property("branch").that.is.a("string");
        expect(res.body).to.have.property("languages").that.is.an("array").with.length.greaterThan(0);
        expect((res.body as DashboardConfigResponse).languages[0]).to.have.keys(["file", "key", "title", "locale"]);
        expect(res.body).to.have.property("themes").that.deep.equals([
            { file: "defaulted", title: "Defaulted" },
            { file: "smoked", title: "Smoked" },
        ]);
        expect(res.body).to.have.property("bwPages").that.deep.equals([
            { key: "t", title: "Top 10 days" },
            { key: "h", title: "Recent hours" },
            { key: "d", title: "Last 30 days" },
            { key: "m", title: "Last 12 months" },
        ]);
    });

    it("should translate dashboard config labels with request locale", async () => {
        const res = await request(app).get("/node/dashboard_config?locale=zh");

        expect(res.status).to.equal(200);
        expect(res.body).to.have.property("bwPages").that.deep.equals([
            { key: "t", title: "最高10天" },
            { key: "h", title: "最近几小时" },
            { key: "d", title: "过去30天" },
            { key: "m", title: "过去12个月" },
        ]);
    });

    it("should return CPU and network interface metadata", async function() {
        this.timeout(6000);
        const res = await request(app).get("/node/system_static");
        const body = res.body as SystemStaticResponse;

        expect(res.status).to.equal(200);
        expect(body).to.have.property("cpu").that.is.an("object");
        expect(body.cpu).to.have.property("modelHtml").that.is.a("string");
        expect(body.cpu).to.have.property("count");
        expect(body).to.have.property("interfaces").that.is.an("array");
    });

    it("should apply an allowlisted dashboard theme", async () => {
        const recorder = createExecFileRecorder();
        const testApp = createControllerTestApp(recorder.execFile);
        const res = await request(testApp)
            .post("/node/theme")
            .send({ theme: "smoked" });

        expect(res.status).to.equal(200);
        expect(res.body).to.deep.equal({ ok: true, theme: "smoked" });
        expect(recorder.calls).to.have.length(1);
        expect(recorder.calls[0][0]).to.equal("sudo");
        expect(recorder.calls[0][1]).to.deep.equal(
            ["/usr/local/bin/quickbox/system/theme/themeSelect-smoked"],
        );
        expect(recorder.calls[0][2]).to.be.a("function");
    });

    it("should reject unknown dashboard themes", async () => {
        const recorder = createExecFileRecorder();
        const testApp = createControllerTestApp(recorder.execFile);
        const res = await request(testApp)
            .post("/node/theme")
            .send({ theme: "../../bad" });

        expect(res.status).to.equal(400);
        expect(recorder.calls).to.have.length(0);
    });

    it("should return the ruTorrent plugin list with installation state", async () => {
        const res = await request(app).get("/node/plugins");
        const body = res.body as PluginsResponse;

        expect(res.status).to.equal(200);
        expect(body).to.have.property("plugins").that.is.an("array").with.length.greaterThan(0);
        expect(body.plugins[0]).to.have.keys(["name", "installed"]);
    });

    it("should apply an allowlisted plugin action", async () => {
        const recorder = createExecFileRecorder();
        const testApp = createControllerTestApp(recorder.execFile);
        const res = await request(testApp)
            .post("/node/plugin")
            .send({ plugin: "rss", action: "install" });

        expect(res.status).to.equal(200);
        expect(res.body).to.deep.equal({ ok: true, plugin: "rss", action: "install" });
    });

    it("should reject unknown plugin inputs before executing", async () => {
        const recorder = createExecFileRecorder();
        const testApp = createControllerTestApp(recorder.execFile);
        const badPlugin = await request(testApp)
            .post("/node/plugin")
            .send({ plugin: "../../bad", action: "install" });
        const badAction = await request(testApp)
            .post("/node/plugin")
            .send({ plugin: "rss", action: "restart" });

        expect(badPlugin.status).to.equal(400);
        expect(badAction.status).to.equal(400);
        expect(recorder.calls).to.have.length(0);
    });

    it("should render removal modals with request-local locale", async () => {
        const zh = await request(app).get("/node/removal_modals?locale=zh");
        const en = await request(app).get("/node/removal_modals");

        expect(zh.status).to.equal(200);
        expect(zh.text).to.include("取消");
        expect(zh.text).to.include("我明白，继续！");
        expect(en.status).to.equal(200);
        expect(en.text).to.include("RemovalConfirm");
        expect(en.text).to.include('data-click-handler="packageRemove"');
    });
});
