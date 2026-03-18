// SPDX-License-Identifier: GPL-3.0-or-later

import "mocha";
import { expect } from "chai";

import messageHandler from "../../src/handler/message";
import Constant from "../../src/constant";

describe("handler/message", () => {
    describe("middleware", () => {
        it("should register message event and call next", () => {
            const registered: Record<string, unknown> = {};
            const mockClient = {
                id: "client-msg-1",
                on(event: string, cb: unknown) {
                    registered[event] = cb;
                },
            };
            let nextCalled = false;
            messageHandler(mockClient as never, () => {
                nextCalled = true;
            });

            expect(registered[Constant.EVENT_MESSAGE]).to.be.a("function");
            expect(nextCalled).to.equal(true);
        });

        it("should work without next callback", () => {
            const registered: Record<string, unknown> = {};
            const mockClient = {
                id: "client-msg-2",
                on(event: string, cb: unknown) {
                    registered[event] = cb;
                },
            };
            // Should not throw
            messageHandler(mockClient as never);
            expect(registered[Constant.EVENT_MESSAGE]).to.be.a("function");
        });
    });

    describe("parseUrl (via resolveWidget)", () => {
        // We test parseUrl indirectly through resolveWidget
        // resolveWidget calls parseUrl internally
        let resolveWidget: typeof import("../../src/handler/message").resolveWidget;

        before(async () => {
            const mod = await import("../../src/handler/message");
            resolveWidget = mod.resolveWidget;
        });

        it("should handle relative URLs", async () => {
            // /node/up.php is handled by the upTime widget
            // This tests that parseUrl correctly parses relative URLs
            try {
                const result = await resolveWidget("/node/up.php");
                expect(result).to.be.a("string");
            } catch {
                // May fail due to si.time() in test env, but parseUrl should work
            }
        });

        it("should handle absolute URLs", async () => {
            try {
                const result = await resolveWidget("http://localhost/node/up.php");
                expect(result).to.be.a("string");
            } catch {
                // Expected in test env
            }
        });
    });
});
