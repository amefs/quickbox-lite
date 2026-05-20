// SPDX-License-Identifier: GPL-3.0-or-later

import "mocha";
import { expect } from "chai";
import childProcess from "child_process";

import { applyRutorrentPluginActionWithExecFile } from "../src/plugins";

describe("plugins", () => {
    it("should execute an allowlisted ruTorrent plugin action", async () => {
        const calls: unknown[][] = [];
        const execFileStub = ((...args: unknown[]) => {
            calls.push(args);
            const callback = args.find((arg): arg is (error: childProcess.ExecFileException | null, stdout: string, stderr: string) => void => typeof arg === "function");
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
