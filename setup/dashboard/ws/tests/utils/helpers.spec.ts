// SPDX-License-Identifier: GPL-3.0-or-later

import "mocha";
import { expect } from "chai";
import * as sinon from "sinon";
import si from "systeminformation";

import { processExists, systemdUnitActive } from "../../src/utils/helpers";

describe("utils/helpers", () => {

    describe("processExists", () => {
        let stub: sinon.SinonStub;

        beforeEach(() => {
            stub = sinon.stub(si, "processes");
        });

        afterEach(() => {
            stub.restore();
        });

        it("should return true when process exists with matching name and user", async () => {
            stub.resolves({
                list: [
                    { name: "node", user: "testuser" },
                    { name: "python", user: "admin" },
                ],
            });

            const result = await processExists("node", "testuser");
            expect(result).to.equal(true);
        });

        it("should return false when process name matches but user doesn't", async () => {
            stub.resolves({
                list: [
                    { name: "node", user: "testuser" },
                    { name: "node", user: "admin" },
                ],
            });

            const result = await processExists("node", "root");
            expect(result).to.equal(false);
        });

        it("should return false when process doesn't exist", async () => {
            stub.resolves({
                list: [
                    { name: "node", user: "testuser" },
                    { name: "python", user: "admin" },
                ],
            });

            const result = await processExists("nginx", "testuser");
            expect(result).to.equal(false);
        });

        it("should return false when process list is empty", async () => {
            stub.resolves({
                list: [],
            });

            const result = await processExists("node", "testuser");
            expect(result).to.equal(false);
        });

        it("should match first occurrence of matching process", async () => {
            stub.resolves({
                list: [
                    { name: "node", user: "testuser" },
                    { name: "node", user: "testuser" },
                    { name: "node", user: "admin" },
                ],
            });

            const result = await processExists("node", "testuser");
            expect(result).to.equal(true);
        });
    });

    describe("systemdUnitActive", () => {
        it("should return false when systemctl is not available or unit is inactive", async () => {
            // On macOS / non-systemd environments systemctl is absent → always false
            const result = await systemdUnitActive("nonexistent-unit-xyz.service");
            expect(result).to.equal(false);
        });
    });
});
