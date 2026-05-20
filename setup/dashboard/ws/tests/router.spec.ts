// SPDX-License-Identifier: GPL-3.0-or-later
// HTTP router integration tests — covers all route groups in src/router.tsx.

import "mocha";
import { expect } from "chai";
import request from "supertest";
import sinon from "sinon";
import childProcess from "child_process";

// Import the fully-configured app (trust proxy + router mounted) rather than
// the raw router, so middleware interactions (e.g. loopback detection) behave
// exactly as in production.
import { app } from "../src/server";

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

describe("router — HTTP routes", () => {
    // ── Root ─────────────────────────────────────────────────────────────────

    describe("GET /", () => {
        it("should return 200 with HTML", async () => {
            const res = await request(app).get("/");
            expect(res.status).to.equal(200);
            expect(res.text).to.include("<html");
            expect(res.text).to.include("QuickBox Websocket");
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

        it("should set locale to 'zh' via direct code", async () => {
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

    describe("GET /node/dashboard_config", () => {
        it("should return static dashboard menu config", async () => {
            const res = await request(app).get("/node/dashboard_config");

            expect(res.status).to.equal(200);
            expect(res.body).to.have.property("version", "v1.5.12");
            expect(res.body).to.have.property("branch").that.is.a("string");
            expect(res.body).to.have.property("languages").that.is.an("array").with.length.greaterThan(0);
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
        it("should return CPU and network interface metadata", async () => {
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
        let execFileStub: sinon.SinonStub;

        beforeEach(() => {
            execFileStub = sinon.stub(childProcess, "execFile").callsFake(((...args: unknown[]) => {
                const callback = args.find((arg): arg is (error: childProcess.ExecFileException | null, stdout: string, stderr: string) => void => typeof arg === "function");
                if (callback) {
                    callback(null, "", "");
                }
                return {} as childProcess.ChildProcess;
            }));
        });

        afterEach(() => {
            execFileStub.restore();
        });

        it("should apply an allowlisted dashboard theme", async () => {
            const res = await request(app)
                .post("/node/theme")
                .send({ theme: "smoked" });

            expect(res.status).to.equal(200);
            expect(res.body).to.deep.equal({ ok: true, theme: "smoked" });
            expect(execFileStub.calledOnceWithExactly(
                "sudo",
                ["/usr/local/bin/quickbox/system/theme/themeSelect-smoked"],
                sinon.match.func,
            )).to.equal(true);
        });

        it("should reject unknown dashboard themes", async () => {
            const res = await request(app)
                .post("/node/theme")
                .send({ theme: "../../bad" });

            expect(res.status).to.equal(400);
            expect(execFileStub.notCalled).to.equal(true);
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
        let execFileStub: sinon.SinonStub;

        beforeEach(() => {
            execFileStub = sinon.stub(childProcess, "execFile").callsFake(((...args: unknown[]) => {
                const callback = args.find((arg): arg is (error: childProcess.ExecFileException | null, stdout: string, stderr: string) => void => typeof arg === "function");
                if (callback) {
                    callback(null, "", "");
                }
                return {} as childProcess.ChildProcess;
            }));
        });

        afterEach(() => {
            execFileStub.restore();
        });

        it("should apply an allowlisted plugin action", async () => {
            const res = await request(app)
                .post("/node/plugin")
                .send({ plugin: "rss", action: "install" });

            expect(res.status).to.equal(200);
            expect(res.body).to.deep.equal({ ok: true, plugin: "rss", action: "install" });
            expect(execFileStub.calledOnceWithExactly(
                "sudo",
                ["/usr/local/bin/quickbox/plugin/install/installplugin-rss"],
                sinon.match.func,
            )).to.equal(true);
        });

        it("should reject unknown plugins before executing", async () => {
            const res = await request(app)
                .post("/node/plugin")
                .send({ plugin: "../../bad", action: "install" });

            expect(res.status).to.equal(400);
            expect(execFileStub.notCalled).to.equal(true);
        });

        it("should reject unknown plugin actions before executing", async () => {
            const res = await request(app)
                .post("/node/plugin")
                .send({ plugin: "rss", action: "restart" });

            expect(res.status).to.equal(400);
            expect(execFileStub.notCalled).to.equal(true);
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
