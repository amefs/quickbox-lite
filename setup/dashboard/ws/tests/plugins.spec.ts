// SPDX-License-Identifier: GPL-3.0-or-later

import "mocha";
import { expect } from "chai";
import childProcess from "child_process";
import { existsSync } from "fs";
import path from "path";

import { applyRutorrentPluginActionWithExecFile, getRutorrentPlugins } from "../src/services/packages/plugins";

describe("plugins", () => {
    it("only lists plugin actions shipped by the repository", () => {
        const plugins = getRutorrentPlugins();
        const scripts = path.resolve(__dirname, "../../../../packages/plugin");
        for (const { name } of plugins) {
            for (const action of ["install", "remove"]) {
                const script = path.join(scripts, action, `${action}plugin-${name}`);
                expect(existsSync(script), script).to.equal(true);
            }
        }
        expect(plugins.find(({ name }) => name === "_noty")?.label).to.equal("_noty / _noty2");
        expect(plugins.map(({ name }) => name)).not.to.include.members(["_noty2", "uploadeta"]);
    });

    it("should execute an allowlisted ruTorrent plugin action", async () => {
        const calls: unknown[][] = [];
        const execFileStub = ((...args: unknown[]) => {
            calls.push(args);
            const callback = args.find((arg): arg is (error: childProcess.ExecException | null, stdout: string, stderr: string) => void => typeof arg === "function");
            if (callback) {
                callback(null, "", "");
            }
            return {} as childProcess.ChildProcess;
        }) as typeof childProcess.execFile;

        await applyRutorrentPluginActionWithExecFile("rss", "install", execFileStub);

        expect(calls).to.have.length(1);
        expect(calls[0][0]).to.equal("sudo");
        expect(calls[0][1]).to.deep.equal(["/usr/local/bin/quickbox/plugin/install/installplugin-rss"]);
        expect(calls[0][2]).to.be.a("function");
    });
});
