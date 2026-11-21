// SPDX-License-Identifier: GPL-3.0-or-later

import "mocha";
import { expect } from "chai";

import { getActiveProfile, getMockSystemdServiceActive, runMockCommand, setActiveProfile } from "../../mock/adapter";
import { ENV_VARIABLE } from "../../mock/mode";
import { buildCommand } from "../../src/socket/command";
import { serviceMap } from "../../src/services/packages/info";

describe("mock command adapter", () => {
    const previousNodeEnv = process.env.NODE_ENV;
    const previousEnv = process.env[ENV_VARIABLE];

    function restoreEnvironment() {
        if (previousNodeEnv === undefined) {
            delete process.env.NODE_ENV;
        } else {
            process.env.NODE_ENV = previousNodeEnv;
        }
        if (previousEnv === undefined) {
            delete process.env.QUICKBOX_ENV;
        } else {
            process.env.QUICKBOX_ENV = previousEnv;
        }
    }

    function enableMock() {
        process.env.NODE_ENV = "test";
        process.env[ENV_VARIABLE] = "mock";
    }

    afterEach(restoreEnvironment);

    it("applies a validated package install to the active profile", () => {
        enableMock();
        setActiveProfile("empty-system");

        expect(runMockCommand(" installpackage :: autodlirssi ")).to.equal(true);
        expect(getActiveProfile().lockFiles).to.include("/install/.autodlirssi.lock");
        expect(getActiveProfile().processes.find((proc) => proc.name === "irssi")).to.not.equal(undefined);
    });

    it("derives mock systemd runtime state from processes and independent unit state", () => {
        enableMock();
        setActiveProfile("all-running");
        const profile = getActiveProfile();
        const deluged = serviceMap.get("deluged");
        const delugedProcess = profile.processes.find(proc => proc.name === "deluged");
        if (deluged && delugedProcess) {delugedProcess.user = deluged.username;}

        expect(getMockSystemdServiceActive("deluged")).to.equal(true);
        expect(profile.enabledServices).to.include("deluged@testuser");
        expect(runMockCommand("systemctl:stop:deluged")).to.equal(true);
        expect(profile.enabledServices).to.include("deluged@testuser");
        expect(getMockSystemdServiceActive("deluged")).to.equal(false);
        expect(runMockCommand("systemctl:restart:deluged")).to.equal(true);
        expect(getMockSystemdServiceActive("deluged")).to.equal(true);

        expect(getMockSystemdServiceActive("authelia")).to.equal(true);
        expect(runMockCommand("systemctl:stop:authelia")).to.equal(true);
        expect(getMockSystemdServiceActive("authelia")).to.equal(false);
        expect(runMockCommand("systemctl:start:authelia")).to.equal(true);
        expect(getMockSystemdServiceActive("authelia")).to.equal(true);
    });

    it("refuses unsupported commands while mock mode is enabled", () => {
        enableMock();

        expect(runMockCommand("unknown::target")).to.equal(false);
    });

    it("uses the command unit for services with a dedicated process user", () => {
        enableMock();
        setActiveProfile("all-running");

        expect(getActiveProfile().enabledServices).to.include("netdata");
        expect(runMockCommand("systemctl:disable:netdata")).to.equal(true);
        expect(getActiveProfile().enabledServices).not.to.include("netdata");
        expect(runMockCommand("systemctl:enable:netdata")).to.equal(true);
        expect(getActiveProfile().enabledServices).to.include("netdata");
        expect(getActiveProfile().enabledServices).not.to.include("netdata@netdata");

        expect(runMockCommand("systemctl:enable:znc")).to.equal(true);
        expect(getActiveProfile().enabledServices).to.include("znc");
        expect(getActiveProfile().enabledServices).not.to.include("znc@znc");
    });

    it("keeps target validation in the command allowlist", () => {
        expect(() => buildCommand("installpackage::not-allowlisted", {
            installpackage: { template: "install-$target$", operations: [], targets: ["autodlirssi"] },
        }, "testuser")).to.throw("Target 'not-allowlisted' not found");
    });

    it("leaves commands alone on real data", () => {
        process.env.NODE_ENV = "production";
        process.env[ENV_VARIABLE] = "mock";

        expect(runMockCommand("installpackage::autodlirssi")).to.equal(undefined);

        process.env.NODE_ENV = "test";
        delete process.env.QUICKBOX_ENV;
        expect(runMockCommand("installpackage::autodlirssi")).to.equal(undefined);
    });
});
