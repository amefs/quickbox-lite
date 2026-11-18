// SPDX-License-Identifier: GPL-3.0-or-later

import "mocha";
import { expect } from "chai";

import { CommandType, buildCommand } from "../../../src/handlers/utils/command";
import { isSafeUsername } from "../../../src/shared/constants";

const config = {
    "systemctl": {
        template: "systemctl $operation$ $target$",
        operations: ["enable", "start"],
        targets: ["deluge-web@$username$", "znc"],
    },
    "installpackage": {
        template: "bash /usr/local/bin/quickbox/package/install/installpackage-$target$",
        operations: [],
        targets: ["autodlirssi", "btsync"],
    },
    "multi-target": {
        template: "multi $target$ $target$",
        operations: [],
        targets: ["target"],
    },
    "no-operation-target": {
        template: "noop",
        operations: [],
        targets: [],
    },
} as CommandType;
const username = "quickbox";


describe("exec", () => {
    describe("command", () => {
        it("should build without error", () => {
            expect(buildCommand("systemctl:enable:znc", config, username))
                .to.equal("systemctl enable znc");
            expect(buildCommand(" systemctl : enable : znc\t", config, username))
                .to.equal("systemctl enable znc");
            expect(buildCommand("installpackage::btsync", config, username))
                .to.equal("bash /usr/local/bin/quickbox/package/install/installpackage-btsync");
        });
        it("accepts branch names without allowing shell injection", () => {
            expect(buildCommand("box:switch-branch:feature/test-1", config, username))
                .to.equal("sudo -n -- /usr/local/bin/quickbox/system/box switch-branch 'feature/test-1'");
            expect(buildCommand("box:switch-branch:main;id", config, username)).to.equal("sudo -n -- /usr/local/bin/quickbox/system/box switch-branch 'main;id'");
            expect(buildCommand("box:switch-branch:main$(id)", config, username)).to.equal("sudo -n -- /usr/local/bin/quickbox/system/box switch-branch 'main$(id)'");
            for (const branch of ["-bad", "main other", "main:other"]) {
                expect(() => buildCommand(`box:switch-branch:${branch}`, config, username)).to.throw(/Invalid branch/);
            }
        });
        it("should build with username", () => {
            expect(buildCommand("systemctl:start:deluge-web", config, username))
                .to.equal("systemctl start deluge-web@quickbox");
        });
        it("should throw error for parameter", () => {
            expect(() => { buildCommand(undefined, config, username); })
                .to.throw(Error, /payload/);
            expect(() => { buildCommand("payload", undefined, username); })
                .to.throw(Error, /config/);
            expect(() => { buildCommand("systemctl:start:deluge-web", config, undefined); })
                .to.throw(Error, /master\.txt/);
            expect(() => { buildCommand("systemctl:start:deluge-web", config, ""); })
                .to.throw(Error, /master\.txt/);
        });
        it("should throw error for invalid payload", () => {
            expect(() => { buildCommand("systemctl:", config, username); })
                .to.throw(Error, /Invalid payload/);
        });
        it("should throw error for command not found", () => {
            expect(() => { buildCommand("error::", config, username); })
                .to.throw(Error, /Command .+ not found/);
        });
        it("should throw error for operation not found", () => {
            expect(() => { buildCommand("systemctl:error:", config, username); })
                .to.throw(Error, /Operation .+ not found/);
        });
        it("should throw error for target not found", () => {
            expect(() => { buildCommand("systemctl:start:error", config, username); })
                .to.throw(Error, /Target .+ not found/);
        });
        it("should throw error for unexpected operation", () => {
            expect(() => { buildCommand("installpackage:error:btsync", config, username); })
                .to.throw(Error, "Unexpected operation 'error' is provided");
        });
        it("should build with multiple target placeholders", () => {
            expect(buildCommand("multi-target::target", config, username))
                .to.equal("multi target target");
        });
        it("should throw error for unexpected target", () => {
            expect(() => { buildCommand("no-operation-target::target", config, username); })
                .to.throw(Error, "Unexpected target 'target' is provided");
        });
        it("should reject a username that is not a safe shell token", () => {
            expect(() => { buildCommand("systemctl:start:deluge-web", config, "bad;id"); })
                .to.throw(Error, /invalid characters/);
            expect(() => { buildCommand("systemctl:start:deluge-web", config, "bad$(id)"); })
                .to.throw(Error, /invalid characters/);
            expect(() => { buildCommand("systemctl:start:deluge-web", config, "bad user"); })
                .to.throw(Error, /invalid characters/);
        });

        // A7: empty string target is required for operations like enable-dev/disable-dev that don't need a target
        it("should allow empty string target when it is in the whitelist", () => {
            const configWithEmptyTarget = {
                box: {
                    template: "bash quickbox $operation$ $target$",
                    operations: ["enable-dev"],
                    targets: ["", "mem"],
                },
            } as CommandType;
            expect(buildCommand("box:enable-dev:", configWithEmptyTarget, username))
                .to.equal("bash quickbox enable-dev ");
        });
        it("should accept a safe username token", () => {
            expect(isSafeUsername("quickbox")).to.equal(true);
            expect(isSafeUsername("user_1.name-2")).to.equal(true);
            expect(isSafeUsername("bad;id")).to.equal(false);
        });
        it("should reject empty string target when it is not in the whitelist", () => {
            const configWithoutEmptyTarget = {
                box: {
                    template: "bash quickbox $operation$ $target$",
                    operations: ["enable-dev"],
                    targets: ["mem"],
                },
            } as CommandType;
            expect(() => { buildCommand("box:enable-dev:", configWithoutEmptyTarget, username); })
                .to.throw(Error, /Target .+ not found/);
        });
    });

    describe("production command templates", () => {
        it("should wrap privileged commands with sudo -n", () => {
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const production = require("../../../config/commands.json") as CommandType;
            expect(production.systemctl?.template.startsWith("sudo -n -- ")).to.equal(true);
            expect(production.installpackage?.template.startsWith("sudo -n -- ")).to.equal(true);
            expect(production.removepackage?.template.startsWith("sudo -n -- ")).to.equal(true);
            expect(production.box?.template.startsWith("sudo -n -- ")).to.equal(true);
            expect(production.ping?.template.startsWith("sudo")).to.equal(false);
            expect(production["command-example"]).to.equal(undefined);
        });
        it("should dispatch package operations through box", () => {
            // box starts a new Dashboard log before the package script writes,
            // so the dialog shows this operation instead of the previous one.
            // Calling installpackage/removepackage directly skips that step.
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const production = require("../../../config/commands.json") as CommandType;
            expect(production.installpackage?.template).to.contain("/quickbox/system/box install ");
            expect(production.removepackage?.template).to.contain("/quickbox/system/box remove ");
        });
    });
});
