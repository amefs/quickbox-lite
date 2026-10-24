// SPDX-License-Identifier: GPL-3.0-or-later

import "mocha";
import { expect } from "chai";

import { getActiveProfile, runMockCommand, setActiveProfile } from "../../src/testing/mock-adapter";
import { buildCommand } from "../../src/handlers/utils/command";

describe("testing mock command adapter", () => {
    const previousNodeEnv = process.env.NODE_ENV;
    const previousMockEnabled = process.env.MOCK_ENABLED;

    afterEach(() => {
        if (previousNodeEnv === undefined) {
            delete process.env.NODE_ENV;
        } else {
            process.env.NODE_ENV = previousNodeEnv;
        }
        if (previousMockEnabled === undefined) {
            delete process.env.MOCK_ENABLED;
        } else {
            process.env.MOCK_ENABLED = previousMockEnabled;
        }
    });

    it("applies a validated package install to the active profile", () => {
        process.env.NODE_ENV = "test";
        process.env.MOCK_ENABLED = "1";
        setActiveProfile("empty-system");

        expect(runMockCommand(" installpackage :: autodlirssi ")).to.equal(true);
        expect(getActiveProfile().lockFiles).to.include("/install/.autodlirssi.lock");
        expect(getActiveProfile().processes.find((proc) => proc.name === "irssi")).to.not.equal(undefined);
    });

    it("refuses unsupported commands while test mode is enabled", () => {
        process.env.NODE_ENV = "test";
        process.env.MOCK_ENABLED = "1";

        expect(runMockCommand("unknown::target")).to.equal(false);
    });

    it("keeps target validation in the command allowlist", () => {
        expect(() => buildCommand("installpackage::not-allowlisted", {
            installpackage: { template: "install-$target$", operations: [], targets: ["autodlirssi"] },
        }, "testuser")).to.throw("Target 'not-allowlisted' not found");
    });

    it("does not mock commands unless both test gates are enabled", () => {
        process.env.NODE_ENV = "production";
        process.env.MOCK_ENABLED = "1";

        expect(runMockCommand("installpackage::autodlirssi")).to.equal(undefined);

        process.env.NODE_ENV = "test";
        delete process.env.MOCK_ENABLED;
        expect(runMockCommand("installpackage::autodlirssi")).to.equal(undefined);
    });
});
