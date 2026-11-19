// SPDX-License-Identifier: GPL-3.0-or-later

import "mocha";
import { expect } from "chai";

import messageHandler, { parseUrl, resolveWidget } from "../../src/socket/message";
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

    describe("parseUrl", () => {
        it("should parse relative URLs", () => {
            expect(parseUrl("/node/data/system_uptime")).to.deep.equal({ pathname: "/node/data/system_uptime", args: {} });
            expect(parseUrl("/node/data/bandwidth?page=d")).to.deep.equal({
                pathname: "/node/data/bandwidth",
                args: { page: "d" },
            });
        });

        it("should parse absolute URLs down to the pathname", () => {
            expect(parseUrl("http://localhost/node/data/system_uptime")).to.deep.equal({ pathname: "/node/data/system_uptime", args: {} });
            expect(parseUrl("https://example.test/node/data/system_uptime?locale=zh")).to.deep.equal({
                pathname: "/node/data/system_uptime",
                args: { locale: "zh" },
            });
        });

        it("should reject malformed URLs", () => {
            expect(() => parseUrl("http://[")).to.throw("Invalid widget URL");
        });

        it("should resolve a widget for relative and absolute URLs alike", async () => {
            const relative = await resolveWidget("/node/data/system_uptime");
            const absolute = await resolveWidget("http://localhost/node/data/system_uptime");
            expect(relative).to.be.an("object");
            expect(relative).to.have.keys("days", "hours", "minutes");
            expect(absolute).to.deep.equal(relative);
        });
    });

    // messageHandler main flow — stub resolveWidget and verify client.send is called correctly
    describe("messageHandler main flow", () => {
        it("should call client.send with key, pathName and boolean success on any payload", (done) => {
            const mockClient = {
                id: "client-msg-flow-1",
                on(event: string, cb: (p: unknown) => Promise<void>) {
                    if (event === Constant.EVENT_MESSAGE) {
                        setTimeout(() => void cb({ key: "test-key", url: "/node/data/system_uptime", requestId: "req-1" }), 0);
                    }
                },
                send(data: unknown) {
                    expect(data).to.have.property("key", "test-key");
                    expect(data).to.have.property("requestId", "req-1");
                    expect(data).to.have.property("url", "/node/data/system_uptime");
                    expect(data).to.have.property("pathName", "/node/data/system_uptime");
                    expect(data).to.have.property("success").that.is.a("boolean");
                    expect(data).to.have.property("response");
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
                        setTimeout(() => void cb({ key: "err-key", url: "/node/data/system_load" }), 0);
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

    // C1: payload validation tests
    describe("C1 — invalid payload rejection", () => {
        it("should reject null payload with success=false", (done) => {
            const mockClient = {
                id: "client-c1-1",
                on(event: string, cb: (p: unknown) => Promise<void>) {
                    if (event === Constant.EVENT_MESSAGE) {
                        setTimeout(() => void cb(null), 0);
                    }
                },
                send(data: Record<string, unknown>) {
                    expect(data.success).to.equal(false);
                    expect(data.message).to.equal("Invalid payload");
                    done();
                },
            };
            messageHandler(mockClient as never);
        });

        it("should reject payload missing url field", (done) => {
            const mockClient = {
                id: "client-c1-2",
                on(event: string, cb: (p: unknown) => Promise<void>) {
                    if (event === Constant.EVENT_MESSAGE) {
                        setTimeout(() => void cb({ key: "K" }), 0);
                    }
                },
                send(data: Record<string, unknown>) {
                    expect(data.success).to.equal(false);
                    expect(data.message).to.equal("Invalid payload");
                    done();
                },
            };
            messageHandler(mockClient as never);
        });

        it("should reject payload with non-string url", (done) => {
            const mockClient = {
                id: "client-c1-3",
                on(event: string, cb: (p: unknown) => Promise<void>) {
                    if (event === Constant.EVENT_MESSAGE) {
                        setTimeout(() => void cb({ key: "K", url: 123 }), 0);
                    }
                },
                send(data: Record<string, unknown>) {
                    expect(data.success).to.equal(false);
                    expect(data.message).to.equal("Invalid payload");
                    done();
                },
            };
            messageHandler(mockClient as never);
        });

        it("should reject string payload (not an object)", (done) => {
            const mockClient = {
                id: "client-c1-4",
                on(event: string, cb: (p: unknown) => Promise<void>) {
                    if (event === Constant.EVENT_MESSAGE) {
                        setTimeout(() => void cb("just a string"), 0);
                    }
                },
                send(data: Record<string, unknown>) {
                    expect(data.success).to.equal(false);
                    expect(data.message).to.equal("Invalid payload");
                    done();
                },
            };
            messageHandler(mockClient as never);
        });
    });

    // C7: page validation test (via resolveWidget)
    describe("C7 — bandwidth page validation", () => {
        it("should fall back to the hourly table for an invalid page value", async () => {
            const invalid = await resolveWidget("/node/data/bandwidth?page=x") as { page: string };
            const hourly = await resolveWidget("/node/data/bandwidth?page=h") as { page: string };
            expect(invalid).to.deep.equal(hourly);
            expect(invalid.page).to.equal("h");
        });

        it("should return the table that matches each page value", async () => {
            for (const page of ["d", "m", "t"]) {
                const result = await resolveWidget(`/node/data/bandwidth?page=${page}`) as { page: string };
                expect(result.page).to.equal(page);
            }
        });
    });

    // B1: SSRF prevention — no default proxy, explicit routes only
    describe("B1 — route allowlist", () => {
        it("should return a batch service status object for /node/v2/service_status_all", async () => {
            const result = await resolveWidget("/node/v2/service_status_all");
            expect(result).to.be.an("object");
            const batch = result as { states: Record<string, unknown>; health: string; retryAfterMs: number };
            expect(batch).to.have.keys("states", "health", "retryAfterMs");
        });

        it("should return structured rows for /node/v2/service_control", async () => {
            const result = await resolveWidget("/node/v2/service_control");
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
            const second = await resolveWidget(`/db/output.log?offset=${first.end}`) as { content: string; start: number; end: number; size: number };
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
                        setTimeout(() => void cb({ key: "x", url: "http://[" }), 0);
                    }
                },
                send(data: Record<string, unknown>) {
                    expect(data.success).to.equal(false);
                    expect(data.message).to.equal("Widget render failed");
                    expect(data.pathName).to.equal("");
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
                        setTimeout(() => void cb({ key: "x", url: "/etc/passwd" }), 0);
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
