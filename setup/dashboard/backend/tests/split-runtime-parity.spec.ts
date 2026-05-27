// SPDX-License-Identifier: GPL-3.0-or-later

import "mocha";
import { expect } from "chai";
import request from "supertest";
import { io as createClient } from "socket.io-client";

import { app as splitApp, server as splitServer } from "../src/server";
import { app as legacyApp } from "../../ws/src/server";

function normalizeHtml(html: string) {
    return html
        .replace(/\r\n/g, "\n")
        .replace(/\s+/g, " ")
        .trim();
}

function expectOrdered(haystack: string, needles: string[]) {
    let previousIndex = -1;
    for (const needle of needles) {
        const currentIndex = haystack.indexOf(needle, previousIndex + 1);
        expect(currentIndex, needle).to.be.greaterThan(previousIndex);
        previousIndex = currentIndex;
    }
}

describe("split runtime parity", () => {
    before(async () => {
        if (!splitServer.listening) {
            await new Promise<void>((resolve, reject) => {
                splitServer.listen(0, "127.0.0.1", (error?: Error) => {
                    if (error) {
                        reject(error);
                        return;
                    }
                    resolve();
                });
            });
        }
    });

    after(async () => {
        if (splitServer.listening) {
            await new Promise<void>((resolve, reject) => {
                splitServer.close((error) => {
                    if (error) {
                        reject(error);
                        return;
                    }
                    resolve();
                });
            });
        }
    });

    const scenarios = [
        { path: "/", label: "root HTML" },
        { path: "/ws", label: "legacy ws HTML" },
    ];

    for (const scenario of scenarios) {
        it(`matches the legacy ${scenario.label} core contract`, async () => {
            const legacyRes = await request(legacyApp).get(`${scenario.path}?locale=zh`).set("Accept-Language", "fr-FR,fr;q=0.9");
            const splitRes = await request(splitApp).get(`${scenario.path}?locale=zh`).set("Accept-Language", "fr-FR,fr;q=0.9");

            expect(legacyRes.status).to.equal(200);
            expect(splitRes.status).to.equal(200);

            const legacyHtml = normalizeHtml(legacyRes.text);
            const splitHtml = normalizeHtml(splitRes.text);

            for (const contract of [
                "<!DOCTYPE html>",
                "Quickbox Dashboard",
                "window.quickboxRuntime",
                '"locale":"zh"',
                'id="service_control_widget"',
                'id="pmc_widget"',
                'id="bw_tables_loading"',
                'id="themeSelectdefaultedConfirm"',
                'id="themeSelectsmokedConfirm"',
            ]) {
                expect(legacyHtml).to.include(contract);
                expect(splitHtml).to.include(contract);
            }

            expect(legacyHtml).to.include("/js/quick.js");
            expect(legacyHtml).to.include("/js/dashboard.js");
            expect(splitHtml).to.not.include("/js/quick.js");
            expect(splitHtml).to.not.include("/js/dashboard.js");

            const expectedBasePath = scenario.path === "/ws" ? "/ws" : "";
            expect(legacyHtml).to.include(`"basePath":"${expectedBasePath}"`);
            expect(splitHtml).to.include(`"basePath":"${expectedBasePath}"`);

            for (const splitRuntimeContract of [
                '"dashboardConfig":"/node/dashboard_config"',
                '"systemStatic":"/node/system_static"',
                '"theme":"/node/theme"',
                '"plugins":"/node/plugins"',
                '"plugin":"/node/plugin"',
                '"outputLog":"/db/output.log"',
                '"skins":"/skins"',
                '"lib":"/lib"',
                '"fonts":"/fonts"',
                '"img":"/img"',
                '"js":"/js"',
                '"lang":"/lang"',
                `"path":"${expectedBasePath === "/ws" ? "/ws/socket.io" : "/socket.io"}"`,
                "/dashboard-client.js",
                "/vendor-jquery.css",
                "/vendor-ui.css",
                "/vendor-misc.css",
            ]) {
                expect(splitHtml).to.include(splitRuntimeContract);
            }

            expect(splitHtml).to.not.include("/lib/");

            expectOrdered(legacyHtml, [
                "window.quickboxRuntime",
                "/js/quick.js",
                "/js/dashboard.js",
            ]);
            expectOrdered(splitHtml, [
                "window.quickboxRuntime",
                "import(\"/dashboard-client.js\")",
            ]);
        });
    }

    it("updates widgets over both Socket.IO paths in the split runtime", async () => {
        const address = splitServer.address();
        if (!address || typeof address === "string") {
            throw new Error("Split server did not expose a usable address");
        }

        const endpoint = `http://127.0.0.1:${address.port}`;

        const connectAndRequest = (socketPath: "/socket.io" | "/ws/socket.io") => {
            return new Promise<string>((resolve, reject) => {
                const client = createClient(endpoint, {
                    path: socketPath,
                    transports: ["websocket"],
                    forceNew: true,
                    reconnection: false,
                });

                client.on("connect", () => {
                    client.emit("message", { key: `parity-${socketPath}`, url: "/node/up" });
                });
                client.on("message", (payload: { success?: boolean; response?: unknown }) => {
                    try {
                        expect(payload.success).to.equal(true);
                        expect(payload.response).to.be.a("string");
                        resolve(payload.response as string);
                    } catch (error) {
                        reject(error instanceof Error ? error : new Error(String(error)));
                    } finally {
                        client.close();
                    }
                });
                client.on("connect_error", reject);
                client.on("error", reject);
            });
        };

        const defaultPathResponse = await connectAndRequest("/socket.io");
        const wsPathResponse = await connectAndRequest("/ws/socket.io");

        expect(defaultPathResponse).to.equal(wsPathResponse);
        expect(defaultPathResponse).to.be.a("string");
        expect(defaultPathResponse.length).to.be.greaterThan(0);
    });
});
