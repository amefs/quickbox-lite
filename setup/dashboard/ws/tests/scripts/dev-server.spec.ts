// SPDX-License-Identifier: GPL-3.0-or-later
/* eslint-disable @typescript-eslint/no-require-imports */

import "mocha";
import { expect } from "chai";

const devServer = require("../../scripts/dev-server.js") as {
    HELP_TEXT: string;
    buildServerConfig: (env?: Record<string, string | undefined>) => {
        wsHost: string;
        wsPort: number;
        listenHost: string;
        listenPort: number;
        target: string;
    };
    envArgs: (argv: string[]) => string[];
    parsePort: (value: string | undefined, fallback: number) => number;
};

describe("scripts/dev-server", () => {
    it("should describe a Node-only dashboard proxy", () => {
        expect(devServer.HELP_TEXT).to.include("Node dashboard server host");
        expect(devServer.HELP_TEXT).to.not.include("PHP");
        expect(devServer.HELP_TEXT).to.not.include("TEST_PHP");
    });

    it("should document the single runtime switch", () => {
        expect(devServer.HELP_TEXT).to.include("--env=<prod|mock[:<profile>]>");
        expect(devServer.HELP_TEXT).to.include("QUICKBOX_ENV");
        expect(devServer.HELP_TEXT).to.not.include("--mock");
    });

    it("should forward the env switch to the server process", () => {
        expect(devServer.envArgs(["--env=mock", "--verbose"])).to.deep.equal(["--env=mock"]);
        expect(devServer.envArgs(["--env", "mock:empty-system"])).to.deep.equal(["--env", "mock:empty-system"]);
        expect(devServer.envArgs(["--env"])).to.deep.equal(["--env"]);
        expect(devServer.envArgs(["--verbose"])).to.deep.equal([]);
    });

    it("should build proxy config for the Node dashboard server", () => {
        const config = devServer.buildServerConfig({
            TEST_WS_HOST: "127.0.0.2",
            TEST_WS_PORT: "9999",
            TEST_SERVER_HOST: "127.0.0.3",
            TEST_SERVER_PORT: "8080",
        });

        expect(config).to.deep.equal({
            wsHost: "127.0.0.2",
            wsPort: 9999,
            listenHost: "127.0.0.3",
            listenPort: 8080,
            target: "http://127.0.0.2:9999",
        });
    });

    it("should ignore legacy PHP environment variables", () => {
        const config = devServer.buildServerConfig({
            TEST_PHP_HOST: "192.0.2.1",
            TEST_PHP_PORT: "9000",
            TEST_PHP_DOCROOT: "/tmp/php-root",
        });

        expect(config.target).to.equal("http://127.0.0.1:8575");
    });
});
