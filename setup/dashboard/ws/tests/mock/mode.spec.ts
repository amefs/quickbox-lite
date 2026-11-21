// SPDX-License-Identifier: GPL-3.0-or-later

import "mocha";
import { expect } from "chai";

import {
    DEFAULT_PROFILE,
    ENV_VARIABLE,
    applyEnvFlag,
    isMockMode,
    mockProfileName,
    parseRuntimeMode,
} from "../../mock/mode";

describe("runtime mode switch", () => {
    const previousEnv = process.env[ENV_VARIABLE];
    const previousNodeEnv = process.env.NODE_ENV;

    function restoreEnvironment() {
        if (previousEnv === undefined) {
            delete process.env.QUICKBOX_ENV;
        } else {
            process.env.QUICKBOX_ENV = previousEnv;
        }
        if (previousNodeEnv === undefined) {
            delete process.env.NODE_ENV;
        } else {
            process.env.NODE_ENV = previousNodeEnv;
        }
    }

    beforeEach(() => {
        delete process.env.QUICKBOX_ENV;
        process.env.NODE_ENV = "development";
    });

    afterEach(restoreEnvironment);

    it("defaults to prod when the switch is absent", () => {
        expect(parseRuntimeMode(undefined)).to.deep.equal({ env: "prod", profile: DEFAULT_PROFILE });
        expect(isMockMode()).to.equal(false);
    });

    it("accepts the explicit prod value", () => {
        process.env[ENV_VARIABLE] = "prod";

        expect(isMockMode()).to.equal(false);
        expect(mockProfileName()).to.equal(DEFAULT_PROFILE);
    });

    it("selects mock with the default profile", () => {
        applyEnvFlag(["--env=mock"]);

        expect(process.env[ENV_VARIABLE]).to.equal("mock");
        expect(isMockMode()).to.equal(true);
        expect(mockProfileName()).to.equal(DEFAULT_PROFILE);
    });

    it("selects mock with the named profile", () => {
        applyEnvFlag(["--env=mock:partial-running"]);

        expect(isMockMode()).to.equal(true);
        expect(mockProfileName()).to.equal("partial-running");
    });

    it("accepts the space-separated flag form", () => {
        applyEnvFlag(["--env", "mock:empty-system"]);

        expect(process.env[ENV_VARIABLE]).to.equal("mock:empty-system");
        expect(mockProfileName()).to.equal("empty-system");
    });

    it("lets a later flag override the default passed by the npm script", () => {
        applyEnvFlag(["--env=mock", "--env=prod"]);

        expect(process.env[ENV_VARIABLE]).to.equal("prod");
        expect(isMockMode()).to.equal(false);
    });

    it("lets a later space-separated flag override an earlier one", () => {
        applyEnvFlag(["--env=mock:empty-system", "--env", "mock:partial-running"]);

        expect(process.env[ENV_VARIABLE]).to.equal("mock:partial-running");
        expect(mockProfileName()).to.equal("partial-running");
    });

    it("leaves the switch alone when no env flag is present", () => {
        applyEnvFlag(["--verbose", "--port=8575"]);

        expect(process.env[ENV_VARIABLE]).to.equal(undefined);
        expect(isMockMode()).to.equal(false);
    });

    it("reports an unknown switch value and stays on real data", () => {
        process.env[ENV_VARIABLE] = "staging";

        expect(parseRuntimeMode("staging")).to.deep.equal({
            env: "prod",
            profile: DEFAULT_PROFILE,
            invalid: "staging",
        });
        expect(isMockMode()).to.equal(false);
    });

    it("lets NODE_ENV=production veto mock data", () => {
        process.env[ENV_VARIABLE] = "mock:all-running";
        process.env.NODE_ENV = "production";

        expect(parseRuntimeMode("mock", "production")).to.deep.equal({
            env: "prod",
            profile: DEFAULT_PROFILE,
            vetoed: true,
        });
        expect(isMockMode()).to.equal(false);
    });
});
