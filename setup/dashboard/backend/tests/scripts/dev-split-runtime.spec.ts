// SPDX-License-Identifier: GPL-3.0-or-later
/* eslint-disable @typescript-eslint/no-require-imports */

import "mocha";
import { expect } from "chai";

const devSplitRuntime = require("../../../scripts/dev-split-runtime.cjs") as {
    HELP_TEXT: string;
    buildRuntimeConfig: (env?: Record<string, string | undefined>) => {
        backendHost: string;
        backendPort: number;
        dashboardRoot: string;
        frontendBuildDir: string;
        backendBuildDir: string;
        backendEntry: string;
        buildCommands: [string, string[]][];
    };
    buildSplitRuntime: (
        config?: ReturnType<typeof devSplitRuntime.buildRuntimeConfig>,
        spawnImpl?: (command: string, args: string[], options: { cwd: string; env: NodeJS.ProcessEnv; stdio: "inherit" }) => { on: (event: string, handler: (...args: unknown[]) => void) => void },
    ) => Promise<void>;
};

describe("scripts/dev-split-runtime", () => {
    it("describes the split runtime build/start flow", () => {
        expect(devSplitRuntime.HELP_TEXT).to.include("TEST_BACKEND_HOST");
        expect(devSplitRuntime.HELP_TEXT).to.include("TEST_BACKEND_PORT");
        expect(devSplitRuntime.HELP_TEXT).to.include("TEST_WS_HOST/PORT");
    });

    it("builds a split runtime config with independent frontend and backend build paths", () => {
        const config = devSplitRuntime.buildRuntimeConfig({
            TEST_BACKEND_HOST: "127.0.0.2",
            TEST_BACKEND_PORT: "9999",
        });

        expect(config.backendHost).to.equal("127.0.0.2");
        expect(config.backendPort).to.equal(9999);
        expect(config.frontendBuildDir).to.match(/frontend[\\/]+dist$/);
        expect(config.backendBuildDir).to.match(/backend[\\/]+dist$/);
        expect(config.backendEntry).to.match(/backend[\\/]+dist[\\/]+server\.js$/);
        expect(config.buildCommands).to.deep.equal([
            ["npm.cmd", ["run", "build", "--workspace", "frontend"]],
            ["npm.cmd", ["run", "build", "--workspace", "backend"]],
        ]);
    });

    it("builds frontend before backend before launch", async () => {
        const calls: { command: string; args: string[]; cwd: string }[] = [];
        const spawnImpl = (command: string, args: string[], options: { cwd: string; env: NodeJS.ProcessEnv; stdio: "inherit" }) => {
            calls.push({ command, args, cwd: options.cwd });
            const handlers: Record<string, (...handlerArgs: unknown[]) => void> = {};
            return {
                on(event: string, handler: (...handlerArgs: unknown[]) => void) {
                    handlers[event] = handler;
                    if (event === "exit") {
                        setImmediate(() => {
                            handler(0, null);
                        });
                    }
                },
            };
        };

        const config = devSplitRuntime.buildRuntimeConfig();
        await devSplitRuntime.buildSplitRuntime(config, spawnImpl);

        expect(calls).to.have.length(2);
        expect(calls[0]).to.deep.include({ command: "npm.cmd" });
        expect(calls[0].args).to.deep.equal(["run", "build", "--workspace", "frontend"]);
        expect(calls[1]).to.deep.include({ command: "npm.cmd" });
        expect(calls[1].args).to.deep.equal(["run", "build", "--workspace", "backend"]);
    });
});
