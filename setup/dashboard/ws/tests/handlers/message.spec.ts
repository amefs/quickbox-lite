// SPDX-License-Identifier: GPL-3.0-or-later

import "mocha";
import { expect } from "chai";

import messageHandler, { resolveWidget } from "../../src/socket/message";
import Constant from "../../src/shared/constants";

describe("handlers/message", () => {
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

    describe("messageHandler main flow", () => {
        it("should resolve the requested bandwidth page and echo the route and request identifiers", (done) => {
            const url = "/node/data/bandwidth";
            const mockClient = {
                id: "client-msg-flow-1",
                on(event: string, cb: (p: unknown) => Promise<void>) {
                    if (event === Constant.EVENT_MESSAGE) {
                        setTimeout(() => void cb({ type: "request", key: "BANDWIDTH", url, requestId: "req-1", args: { page: "d" } }), 0);
                    }
                },
                send(data: unknown) {
                    expect(data).to.have.property("type", "reply");
                    expect(data).to.have.property("key", "BANDWIDTH");
                    expect(data).to.have.property("requestId", "req-1");
                    expect(data).to.have.property("url", url);
                    expect(data).not.to.have.property("pathName");
                    expect(data).to.have.property("success", true);
                    expect(data).to.have.nested.property("response.page", "d");
                    done();
                },
            };
            messageHandler(mockClient as never);
        });

        it("should accept legacy SSH_OUTPUT requests with query parameters and echo pathName", (done) => {
            const url = "/db/output.log?offset=0&length=65536";
            const mockClient = {
                id: "client-msg-legacy-ssh-output",
                on(event: string, cb: (p: unknown) => Promise<void>) {
                    if (event === Constant.EVENT_MESSAGE) {
                        setTimeout(() => void cb({ key: "SSH_OUTPUT", url, requestId: "SSH_OUTPUT:1" }), 0);
                    }
                },
                send(data: unknown) {
                    expect(data).to.have.property("type", "reply");
                    expect(data).to.have.property("key", "SSH_OUTPUT");
                    expect(data).to.have.property("requestId", "SSH_OUTPUT:1");
                    expect(data).to.have.property("url", url);
                    expect(data).to.have.property("pathName", "/db/output.log");
                    expect(data).to.have.property("success", true);
                    expect(data).to.have.nested.property("response.content");
                    done();
                },
            };
            messageHandler(mockClient as never);
        });

        it("should always call client.send even when resolveWidget throws", (done) => {
            const mockClient = {
                id: "client-msg-flow-2",
                on(event: string, cb: (p: unknown) => Promise<void>) {
                    if (event === Constant.EVENT_MESSAGE) {
                        setTimeout(() => void cb({ type: "request", key: "err-key", url: "/node/data/system_load", requestId: "req-2" }), 0);
                    }
                },
                send(data: unknown) {
                    expect(data).to.have.property("key", "err-key");
                    expect(data).to.have.property("success").that.is.a("boolean");
                    done();
                },
            };
            messageHandler(mockClient as never);
        });
    });

    describe("invalid payload rejection", () => {
        const request = { type: "request", key: "UPTIME", url: "/node/data/system_uptime", requestId: "req-1" };
        const invalidPayloads = [
            { name: "null payload", payload: null },
            { name: "string payload", payload: "just a string" },
            { name: "missing URL", payload: { ...request, url: undefined } },
            { name: "non-string URL", payload: { ...request, url: 123 } },
            { name: "missing request ID", payload: { ...request, requestId: undefined } },
            { name: "missing type", payload: { ...request, type: undefined } },
            { name: "push used as a request", payload: { ...request, type: "push" } },
            { name: "string log offset", payload: { ...request, key: "SSH_OUTPUT", url: "/db/output.log", args: { offset: "8" } } },
        ];

        for (const { name, payload } of invalidPayloads) {
            it(`should reject ${name}`, (done) => {
                const mockClient = {
                    on(event: string, cb: (value: unknown) => Promise<void>) {
                        if (event === Constant.EVENT_MESSAGE) {
                            setTimeout(() => void cb(payload), 0);
                        }
                    },
                    send(data: unknown) {
                        expect(data).to.deep.equal({ type: "protocol-error", message: "Invalid payload" });
                        done();
                    },
                };
                messageHandler(mockClient as never);
            });
        }
    });

    // C7: page validation test (via resolveWidget)
    describe("C7 — bandwidth page validation", () => {
        it("should fall back to the hourly table for an invalid page value", async () => {
            const invalid = await resolveWidget("/node/data/bandwidth", { page: "x" }) as { page: string };
            const hourly = await resolveWidget("/node/data/bandwidth", { page: "h" }) as { page: string };
            expect(invalid).to.deep.equal(hourly);
            expect(invalid.page).to.equal("h");
        });

        it("should return the table that matches each page value", async () => {
            for (const page of ["d", "m", "t"]) {
                const result = await resolveWidget("/node/data/bandwidth", { page }) as { page: string };
                expect(result.page).to.equal(page);
            }
        });
    });

    // B1: SSRF prevention — no default proxy, explicit routes only
    describe("B1 — route allowlist", () => {
        it("should return a batch service status object for /node/data/service_status_all", async () => {
            const result = await resolveWidget("/node/data/service_status_all");
            expect(result).to.be.an("object");
            const batch = result as { states: Record<string, unknown>; health: string; retryAfterMs: number };
            expect(batch).to.have.keys("states", "health", "retryAfterMs");
        });

        it("should return structured rows for /node/data/service_control", async () => {
            const result = await resolveWidget("/node/data/service_control");
            expect(result).to.be.an("object");
            expect(result).to.have.property("rows").that.is.an("array");
        });

        it("should return compact package state for /node/data/pmc", async () => {
            const result = await resolveWidget("/node/data/pmc");
            expect(result).to.be.an("object");
            expect(result).to.have.keys("installedByPackage", "installLockExists");
        });

        it("should return an object with content, start, end, size and epoch for /db/output.log", async () => {
            const result = await resolveWidget("/db/output.log");
            expect(result).to.be.an("object");
            expect(result).to.have.property("content");
            expect(result).to.have.property("start");
            expect(result).to.have.property("end");
            expect(result).to.have.property("size");
            expect(result).to.have.property("epoch");
        });

        it("should support offset parameter for /db/output.log", async () => {
            const first = await resolveWidget("/db/output.log") as { content: string; start: number; end: number; size: number };
            const second = await resolveWidget("/db/output.log", { offset: first.end }) as { content: string; start: number; end: number; size: number };
            expect(second.content).to.equal("");
            expect(second.end).to.equal(first.end);
        });

        it("should throw for unknown routes", async () => {
            try {
                await resolveWidget("/etc/passwd");
                expect.fail("should have thrown");
            } catch (err) {
                expect((err as Error).message).to.include("Unknown widget route");
            }
        });

        it("should throw for path traversal attempts", async () => {
            try {
                await resolveWidget("/../../../etc/passwd");
                expect.fail("should have thrown");
            } catch (err) {
                expect((err as Error).message).to.include("Unknown widget route");
            }
        });
    });

    describe("malformed URL and sanitized errors", () => {
        it("should reject a malformed absolute URL without throwing out of the handler", (done) => {
            const mockClient = {
                id: "client-malformed-url",
                on(event: string, cb: (p: unknown) => Promise<void>) {
                    if (event === Constant.EVENT_MESSAGE) {
                        setTimeout(() => void cb({ type: "request", key: "x", url: "http://[", requestId: "malformed" }), 0);
                    }
                },
                send(data: Record<string, unknown>) {
                    expect(data.success).to.equal(false);
                    expect(data.message).to.equal("Widget render failed");
                    expect(data.url).to.equal("http://[");
                    done();
                },
            };
            messageHandler(mockClient as never);
        });

        it("should not echo internal route details to the client", (done) => {
            const mockClient = {
                id: "client-unknown-route",
                on(event: string, cb: (p: unknown) => Promise<void>) {
                    if (event === Constant.EVENT_MESSAGE) {
                        setTimeout(() => void cb({ type: "request", key: "x", url: "/etc/passwd", requestId: "unknown" }), 0);
                    }
                },
                send(data: Record<string, unknown>) {
                    expect(data.success).to.equal(false);
                    expect(data.message).to.equal("Widget render failed");
                    expect(String(data.message)).to.not.include("/etc/passwd");
                    done();
                },
            };
            messageHandler(mockClient as never);
        });
    });
});
