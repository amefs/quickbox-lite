/* eslint-disable @typescript-eslint/no-non-null-assertion */
// SPDX-License-Identifier: GPL-3.0-or-later

import "mocha";
import { expect } from "chai";
import fs from "fs";
import os from "os";
import path from "path";

import execHandler, {
    decodeExecOutput,
    isPidAlive,
    isUpdateInProgress,
    releaseExecSlot,
    resetExecSlotsForTests,
    tryAcquireExecSlot,
} from "../../src/handlers/exec";
import Constant from "../../src/shared/constants";

/** Helper to build a minimal mock Socket client */
function buildMockClient(onExecCallback?: (data: unknown) => void) {
    return {
        on(event: string, cb: (payload: unknown) => void) {
            if (event === Constant.EVENT_EXEC) {
                this._trigger = cb;
            }
        },
        emit(_event: string, data: unknown) {
            onExecCallback?.(data);
        },
        _trigger: null as ((payload: unknown) => void) | null,
    };
}

describe("handlers/exec", () => {
    describe("decodeExecOutput", () => {
        it("should decode utf8 buffer correctly", () => {
            const output = decodeExecOutput(Buffer.from("hello", "utf8"));
            expect(output).to.equal("hello");
        });

        it("should fallback to gb18030 for non-utf8 buffer", () => {
            const output = decodeExecOutput(Buffer.from([0xd6, 0xd0, 0xce, 0xc4])); // 中文 in GBK/GB18030
            expect(output).to.equal("中文");
        });
    });

    describe("middleware", () => {
        it("should register exec event and call next", () => {
            const mockClient = buildMockClient();
            let nextCalled = false;
            execHandler(mockClient as never, () => { nextCalled = true; });
            expect(mockClient._trigger).to.be.a("function");
            expect(nextCalled).to.equal(true);
        });

        it("should work without next callback", () => {
            const mockClient = buildMockClient();
            // eslint-disable-next-line @typescript-eslint/no-confusing-void-expression
            expect(() => execHandler(mockClient as never)).to.not.throw();
            expect(mockClient._trigger).to.be.a("function");
        });
    });

    describe("execHandler — invalid command", () => {
        it("should emit {success:false} for unknown command payload", (done) => {
            const mockClient = buildMockClient((data) => {
                expect(data).to.have.property("success", false);
                expect(data).to.have.property("cmd", "notexist::");
                done();
            });
            execHandler(mockClient as never);
            mockClient._trigger!("notexist::");
        });

        // C2: non-string payload validation
        it("should emit {success:false} for non-string payload (null)", (done) => {
            const mockClient = buildMockClient((data) => {
                const d = data as Record<string, unknown>;
                expect(d).to.have.property("success", false);
                expect(d).to.have.property("message", "Invalid payload");
                done();
            });
            execHandler(mockClient as never);
            mockClient._trigger!(null);
        });

        it("should emit {success:false} for non-string payload (object)", (done) => {
            const mockClient = buildMockClient((data) => {
                const d = data as Record<string, unknown>;
                expect(d).to.have.property("success", false);
                expect(d).to.have.property("message", "Invalid payload");
                done();
            });
            execHandler(mockClient as never);
            mockClient._trigger!({ command: "ping" });
        });

        it("should emit {success:false} for non-string payload (number)", (done) => {
            const mockClient = buildMockClient((data) => {
                const d = data as Record<string, unknown>;
                expect(d).to.have.property("success", false);
                expect(d).to.have.property("message", "Invalid payload");
                done();
            });
            execHandler(mockClient as never);
            mockClient._trigger!(42);
        });
    });

    describe("concurrency and update lock", () => {
        afterEach(() => {
            resetExecSlotsForTests();
        });

        it("should refuse additional slots beyond the per-socket limit", () => {
            const socket = {} as never;
            expect(tryAcquireExecSlot(socket, 1, 8)).to.equal(true);
            expect(tryAcquireExecSlot(socket, 1, 8)).to.equal(false);
            releaseExecSlot(socket);
            expect(tryAcquireExecSlot(socket, 1, 8)).to.equal(true);
            releaseExecSlot(socket);
        });

        it("should treat a live pid file as an in-progress update", () => {
            const pidPath = path.join(os.tmpdir(), `quickbox-update-test-${process.pid}.pid`);
            fs.writeFileSync(pidPath, `${process.pid}\n`);
            try {
                expect(isUpdateInProgress(pidPath)).to.equal(true);
            } finally {
                fs.unlinkSync(pidPath);
            }
        });

        it("should ignore a stale pid file", () => {
            const pidPath = path.join(os.tmpdir(), `quickbox-update-stale-${process.pid}.pid`);
            fs.writeFileSync(pidPath, "99999999\n");
            try {
                expect(isPidAlive(99999999)).to.equal(false);
                expect(isUpdateInProgress(pidPath)).to.equal(false);
            } finally {
                fs.unlinkSync(pidPath);
            }
        });
    });

});
