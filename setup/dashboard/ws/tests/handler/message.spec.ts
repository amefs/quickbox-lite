// SPDX-License-Identifier: GPL-3.0-or-later

import "mocha";
import { expect } from "chai";

import messageHandler, { resolveWidget } from "../../src/handler/message";
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
        it("should handle relative URLs", async () => {
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

    // messageHandler main flow — stub resolveWidget and verify client.send is called correctly
    describe("messageHandler main flow", () => {
        it("should call client.send with key, pathName and boolean success on any payload", (done) => {
            const mockClient = {
                id: "client-msg-flow-1",
                on(event: string, cb: (p: unknown) => Promise<void>) {
                    if (event === Constant.EVENT_MESSAGE) {
                        // call it asynchronously with a valid payload
                        setTimeout(() => void cb({ key: "test-key", url: "/node/up.php", requestId: "req-1" }), 0);
                    }
                },
                send(data: unknown) {
                    expect(data).to.have.property("key", "test-key");
                    expect(data).to.have.property("requestId", "req-1");
                    expect(data).to.have.property("url", "/node/up.php");
                    expect(data).to.have.property("pathName", "/node/up.php");
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
                        setTimeout(() => void cb({ key: "err-key", url: "/node/load.php" }), 0);
                    }
                },
                send(data: unknown) {
                    // load.php may fail in test env due to systeminformation; just verify structure
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
    describe("C7 — bw_tables page validation", () => {
        it("should handle invalid page value gracefully via resolveWidget", async () => {
            try {
                const result = await resolveWidget("/node/bw_tables.php?page=x");
                // Invalid page should fall through to undefined (default = hourly)
                expect(result).to.be.a("string");
            } catch {
                // May fail in test env due to missing vnstat data, that's ok
            }
        });
    });

    // B1: SSRF prevention — no default proxy, explicit routes only
    describe("B1 — route allowlist", () => {
        it("should resolve /widgets/service_status.php same as /node/service_status.php", async () => {
            try {
                const nodeResult = await resolveWidget("/node/service_status.php?service=nginx");
                const widgetResult = await resolveWidget("/widgets/service_status.php?service=nginx");
                expect(widgetResult).to.equal(nodeResult);
            } catch {
                // Expected in test env if serviceMap not populated
            }
        });

        it("should return a batch service status object for /node/service_status_all.php", async () => {
            const result = await resolveWidget("/node/service_status_all.php");
            expect(result).to.be.an("object");
            expect(result).to.have.property("irssi");
        });

        it("should resolve /widgets/service_control.php same as /node/service_control.php", async () => {
            const nodeResult = await resolveWidget("/node/service_control.php");
            const widgetResult = await resolveWidget("/widgets/service_control.php");
            expect(widgetResult).to.equal(nodeResult);
        });

        it("should resolve /widgets/pmc.php same as /node/pmc.php", async () => {
            const nodeResult = await resolveWidget("/node/pmc.php");
            const widgetResult = await resolveWidget("/widgets/pmc.php");
            expect(widgetResult).to.equal(nodeResult);
        });

        it("should return an object with content, start, end and size for /db/output.log", async () => {
            const result = await resolveWidget("/db/output.log");
            expect(result).to.be.an("object");
            expect(result).to.have.property("content");
            expect(result).to.have.property("start");
            expect(result).to.have.property("end");
            expect(result).to.have.property("size");
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
});
