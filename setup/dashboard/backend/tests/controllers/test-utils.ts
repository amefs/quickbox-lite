// SPDX-License-Identifier: GPL-3.0-or-later

import express from "express";
import path from "path";
import childProcess from "child_process";

import { createAppRouter } from "../../src/router";

export function createControllerTestApp(execFile: typeof childProcess.execFile = childProcess.execFile) {
    const testApp = express();
    testApp.set("trust proxy", "loopback");
    testApp.use(createAppRouter({
        dashboardDir: path.resolve(__dirname, "..", "..", ".."),
        execFile,
    }));
    return testApp;
}

export function createExecFileRecorder() {
    const calls: unknown[][] = [];
    const execFile = ((...args: unknown[]) => {
        calls.push(args);
        const callback = args.find((arg): arg is (error: childProcess.ExecFileException | null, stdout: string, stderr: string) => void => typeof arg === "function");
        if (callback) {
            callback(null, "", "");
        }
        return {} as childProcess.ChildProcess;
    }) as typeof childProcess.execFile;

    return { calls, execFile };
}
