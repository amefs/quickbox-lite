/* eslint-disable @typescript-eslint/no-non-null-assertion */
// SPDX-License-Identifier: GPL-3.0-or-later

import "mocha";
import { expect } from "chai";

import execHandler from "../../src/handler/exec";
import Constant from "../../src/constant";

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

describe("handler/exec", () => {
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

        it("should emit {success:false} for non-string payload (null)", (done) => {
            const mockClient = buildMockClient((data) => {
                expect(data).to.have.property("success", false);
                done();
            });
            execHandler(mockClient as never);
            mockClient._trigger!(null);
        });

        it("should emit {success:false} for non-string payload (object)", (done) => {
            const mockClient = buildMockClient((data) => {
                expect(data).to.have.property("success", false);
                done();
            });
            execHandler(mockClient as never);
            mockClient._trigger!({ command: "ping" });
        });
    });

});
