// SPDX-License-Identifier: GPL-3.0-or-later

import "mocha";
import { expect } from "chai";

import { CommandType, buildCommand } from "../../../src/handlers/utils/command";

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
});
