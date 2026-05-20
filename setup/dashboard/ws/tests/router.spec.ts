// SPDX-License-Identifier: GPL-3.0-or-later
// HTTP router integration tests — covers all route groups in src/router.tsx.

import "mocha";
import { expect } from "chai";
import express from "express";
import path from "path";
import request from "supertest";
import childProcess from "child_process";

// Import the fully-configured app (trust proxy + router mounted) rather than
// the raw router, so middleware interactions (e.g. loopback detection) behave
// exactly as in production.
import { app } from "../src/server";
import { createAppRouter } from "../src/router";

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

function createRouterTestApp(execFile: typeof childProcess.execFile = childProcess.execFile) {
    const testApp = express();
    testApp.set("trust proxy", "loopback");
    testApp.use(createAppRouter({
        dashboardDir: path.resolve(__dirname, "..", ".."),
        debugEnabled: true,
        execFile,
    }));
    return testApp;
}

function createExecFileRecorder() {
    const calls: unknown[][] = [];
    const execFile = ((...args: unknown[]) => {
        calls.push(args);
        const callback = args.find((arg): arg is (error: childProcess.ExecFileException | null, stdout: string, stderr: string) => void => typeof arg === "function");
        if (callback) {
            callback(null, "", "");
        }
        return {} as childProcess.ChildProcess;
    }) as typeof childProcess.execFile;

    return { calls, execFile };
}

describe("router — HTTP routes", () => {
    // ── Root ─────────────────────────────────────────────────────────────────

    describe("GET /", () => {
        it("should return 200 with the Node-rendered dashboard shell", async () => {
            const res = await request(app).get("/");
            expect(res.status).to.equal(200);
            expect(res.text).to.include("<!DOCTYPE html>");
            expect(res.text).to.include("Quickbox Dashboard");
            expect(res.text).to.include("id=\"service_control_widget\"");
            expect(res.text).to.include("quickbox:locale");
            expect(res.text).to.include("window.serviceUpdateHandler");
            expect(res.text).to.include("startStatusUpdates");
            expect(res.text).to.include("/lib/datatables/js/jquery.dataTables.min.js");
            expect(res.text).to.not.include("panel.app_status.ws.js");
            expect(res.text).to.not.include("panel.app_service.ws.js");
        });

        it("should render the dashboard shell with request-local locale", async () => {
            const zh = await request(app).get("/?locale=zh");
            const en = await request(app).get("/?locale=en");

            expect(zh.status).to.equal(200);
            expect(en.status).to.equal(200);
            expect(zh.text).to.include("服务控制中心");
            expect(en.text).to.include("Service Control Center");
        });

        it("should render the dashboard shell under the legacy /ws base path", async () => {
            const res = await request(app).get("/ws?locale=zh");

            expect(res.status).to.equal(200);
            expect(res.text).to.include("服务控制中心");
            expect(res.text).to.include('path: "/ws/socket.io"');
            expect(res.text).to.include("window.quickboxApiBase = \"/ws\"");
        });
    });

    // ── Locale (/set) ────────────────────────────────────────────────────────

    describe("GET /set", () => {
        it("should return 200 and 'en' for a loopback request", async () => {
            const res = await request(app).get("/set?lang=en");
            expect(res.status).to.equal(200);
            expect(res.text).to.equal("en");
        });

        it("should return 403 for non-localhost requests via X-Forwarded-For", async () => {
            // app.set("trust proxy", "loopback") causes X-Forwarded-For to override req.ip
            // and isTestMode() is false in normal Mocha runs (MOCK_ENABLED not set)
            const res = await request(app)
                .get("/set?lang=en")
                .set("X-Forwarded-For", "203.0.113.1");
            expect(res.status).to.equal(403);
        });

        it("should normalize locale to 'zh' via direct code", async () => {
            const res = await request(app).get("/set?lang=zh");
            expect(res.status).to.equal(200);
            expect(res.text).to.equal("zh");
        });

        it("should normalise 'zh-CN' alias to 'zh'", async () => {
            const res = await request(app).get("/set?lang=zh-CN");
            expect(res.status).to.equal(200);
            expect(res.text).to.equal("zh");
        });

        it("should default to 'en' when lang param is absent", async () => {
            const res = await request(app).get("/set");
            expect(res.status).to.equal(200);
            expect(res.text).to.equal("en");
        });

        it("should reject path-traversal locale values and fall back to 'en'", async () => {
            await request(app).get("/set?lang=en");
            const res = await request(app).get("/set?lang=../../etc/passwd");
            expect(res.status).to.equal(200);
            expect(res.text).to.equal("en");
        });

        it("should not mutate the dashboard shell locale globally", async () => {
            await request(app).get("/set?lang=zh");
            const res = await request(app).get("/");

            expect(res.status).to.equal(200);
            expect(res.text).to.include("Service Control Center");
            expect(res.text).to.not.include("服务控制中心");
        });
    });

    // ── Node widget endpoints (/node/*) ───────────────────────────────────────

    describe("GET /node/menu", () => {
        it("should return 200 with JSON containing mainMenuHtml and showPluginTab", async () => {
            const res = await request(app).get("/node/menu");
            expect(res.status).to.equal(200);
            expect(res.body).to.be.an("object");
            expect(res.body).to.have.property("mainMenuHtml").that.is.a("string");
            expect(res.body).to.have.property("showPluginTab").that.is.a("boolean");
        });

        it("should not expose $username$ placeholders in the response", async () => {
            const res = await request(app).get("/node/menu");
            const body = res.body as { mainMenuHtml: string };
            expect(body.mainMenuHtml).to.not.include("$username$");
        });
    });

    describe("legacy /ws node routes", () => {
        it("should route /ws/node/dashboard_config to the Node handler", async () => {
            const res = await request(app).get("/ws/node/dashboard_config");

            expect(res.status).to.equal(200);
            expect(res.body).to.have.property("version", "v1.5.12");
        });
    });

    describe("legacy inc assets", () => {
        it("should not serve the status updater script now owned by the Node shell", async () => {
            const res = await request(app).get("/inc/panel.app_status.ws.js");

            expect(res.status).to.equal(404);
        });

        it("should not serve the command-handler script now owned by the Node shell", async () => {
            const res = await request(app).get("/inc/panel.app_service.ws.js");

            expect(res.status).to.equal(404);
        });

        it("should not expose PHP partials as static files", async () => {
            const res = await request(app).get("/inc/config.php");

            expect(res.status).to.equal(404);
            expect(res.text).to.not.include("<?php");
        });
    });

    describe("GET /node/removal_modals locale", () => {
        it("should render with request-local locale", async () => {
            const res = await request(app).get("/node/removal_modals?locale=zh");

            expect(res.status).to.equal(200);
            expect(res.text).to.include("取消");
            expect(res.text).to.include("我明白，继续！");
        });
    });

    describe("GET /node/dashboard_config", () => {
        it("should return static dashboard menu config", async () => {
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
    });

    describe("GET /node/system_static", () => {
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
    });

    describe("POST /node/theme", () => {
        let execFileCalls: unknown[][];
        let injectedApp: express.Express;

        beforeEach(() => {
            const recorder = createExecFileRecorder();
            execFileCalls = recorder.calls;
            injectedApp = createRouterTestApp(recorder.execFile);
        });

        it("should apply an allowlisted dashboard theme", async () => {
            const res = await request(injectedApp)
                .post("/node/theme")
                .send({ theme: "smoked" });

            expect(res.status).to.equal(200);
            expect(res.body).to.deep.equal({ ok: true, theme: "smoked" });
            expect(execFileCalls).to.have.length(1);
            expect(execFileCalls[0][0]).to.equal("sudo");
            expect(execFileCalls[0][1]).to.deep.equal(
                ["/usr/local/bin/quickbox/system/theme/themeSelect-smoked"],
            );
            expect(execFileCalls[0][2]).to.be.a("function");
        });

        it("should reject unknown dashboard themes", async () => {
            const res = await request(injectedApp)
                .post("/node/theme")
                .send({ theme: "../../bad" });

            expect(res.status).to.equal(400);
            expect(execFileCalls).to.have.length(0);
        });
    });

    describe("GET /node/plugins", () => {
        it("should return the ruTorrent plugin list with installation state", async () => {
            const res = await request(app).get("/node/plugins");
            const body = res.body as PluginsResponse;

            expect(res.status).to.equal(200);
            expect(body).to.have.property("plugins").that.is.an("array").with.length.greaterThan(0);
            expect(body.plugins[0]).to.have.keys(["name", "installed"]);
        });
    });

    describe("POST /node/plugin", () => {
        let execFileCalls: unknown[][];
        let injectedApp: express.Express;

        beforeEach(() => {
            const recorder = createExecFileRecorder();
            execFileCalls = recorder.calls;
            injectedApp = createRouterTestApp(recorder.execFile);
        });

        it("should apply an allowlisted plugin action", async () => {
            const res = await request(injectedApp)
                .post("/node/plugin")
                .send({ plugin: "rss", action: "install" });

            expect(res.status).to.equal(200);
            expect(res.body).to.deep.equal({ ok: true, plugin: "rss", action: "install" });
        });

        it("should reject unknown plugins before executing", async () => {
            const res = await request(injectedApp)
                .post("/node/plugin")
                .send({ plugin: "../../bad", action: "install" });

            expect(res.status).to.equal(400);
            expect(execFileCalls).to.have.length(0);
        });

        it("should reject unknown plugin actions before executing", async () => {
            const res = await request(injectedApp)
                .post("/node/plugin")
                .send({ plugin: "rss", action: "restart" });

            expect(res.status).to.equal(400);
            expect(execFileCalls).to.have.length(0);
        });
    });

    describe("GET /node/removal_modals", () => {
        it("should return 200 with an HTML fragment", async () => {
            const res = await request(app).get("/node/removal_modals");
            expect(res.status).to.equal(200);
            expect(res.text).to.be.a("string");
        });

        it("should include at least one RemovalConfirm modal", async () => {
            const res = await request(app).get("/node/removal_modals");
            expect(res.text).to.include("RemovalConfirm");
        });

        it("should set data-click-handler='packageRemove' on confirm buttons", async () => {
            const res = await request(app).get("/node/removal_modals");
            expect(res.text).to.include('data-click-handler="packageRemove"');
        });
    });

    // ── Debug endpoints (/debug*) ─────────────────────────────────────────────
    // NODE_ENV=test → debugEnabled is true (test !== production)

    describe("GET /debug", () => {
        it("should return 200 with an HTML page", async () => {
            const res = await request(app).get("/debug");
            expect(res.status).to.equal(200);
            expect(res.text).to.include("<html");
        });
    });

    describe("GET /debug/node", () => {
        it("should return 400 when url param is missing", async () => {
            const res = await request(app).get("/debug/node");
            expect(res.status).to.equal(400);
            expect(res.body).to.have.property("error");
        });

        it("should return 400 when url param is empty", async () => {
            const res = await request(app).get("/debug/node?url=");
            expect(res.status).to.equal(400);
        });

        it("should return 200 for a valid widget url", async () => {
            const res = await request(app).get("/debug/node?url=/node/up.php");
            expect(res.status).to.equal(200);
        });
    });
});
