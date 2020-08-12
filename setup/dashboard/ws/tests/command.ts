import "mocha";
import { expect } from "chai";

import { CommandType, buildCommand } from "../src/handler/utils/command";

const config = {
    "systemctl": {
        "template": "systemctl $operation$ $target$",
        "operations": ["enable", "start"],
        "targets": ["deluge-web@$username$", "znc"]
    },
    "installpackage": {
        "template": "bash /usr/local/bin/quickbox/package/install/installpackage-$target$",
        "operations": [],
        "targets": ["autodlirssi", "btsync"]
    },
    "multi-target": {
        "template": "multi $target$ $target$",
        "operations": [],
        "targets": ["target"]
    },
    "no-operation-target": {
        "template": "noop",
        "operations": [],
        "targets": []
    }
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
            expect(() => { buildCommand(undefined, config, username) })
            .to.throw(Error, /payload/);
            expect(() => { buildCommand("payload", undefined, username) })
            .to.throw(Error, /config/);
            expect(() => { buildCommand("systemctl:start:deluge-web", config, undefined) })
            .to.throw(Error, /username/);
        });
        it("should throw error for invalid payload", () => {
            expect(() => { buildCommand("systemctl:", config, username) })
            .to.throw(Error, /Invalid payload/);
        });
        it("should throw error for command not found", () => {
            expect(() => { buildCommand("error::", config, username) })
            .to.throw(Error, /Command .+ not found/);
        });
        it("should throw error for operation not found", () => {
            expect(() => { buildCommand("systemctl:error:", config, username) })
            .to.throw(Error, /Operation .+ not found/);
        });
        it("should throw error for target not found", () => {
            expect(() => { buildCommand("systemctl:start:error", config, username) })
            .to.throw(Error, /Target .+ not found/);
        });
        it("should throw error for unexpected operation", () => {
            expect(() => { buildCommand("installpackage:error:btsync", config, username) })
            .to.throw(Error, 'Unexpected operation \'error\' is provided');
        });
        it("should throw invalid template", () => {
            expect(() => { buildCommand("multi-target::target", config, username) })
            .to.throw(Error, /Invalid template/);
        });
        it("should throw error for unexpected target", () => {
            expect(() => { buildCommand("no-operation-target::target", config, username) })
            .to.throw(Error, 'Unexpected target \'target\' is provided');
        });
    });
});
