// SPDX-License-Identifier: GPL-3.0-or-later

import { execFile, type ExecFileOptionsWithStringEncoding } from "child_process";

export async function runCollectorCommand(
    file: string,
    args: string[],
    options: { signal?: AbortSignal; env?: NodeJS.ProcessEnv; maxBuffer?: number } = {},
): Promise<{ stdout: string; stderr: string }> {
    const { signal, ...execOptions } = options;
    signal?.throwIfAborted();
    const commandOptions: ExecFileOptionsWithStringEncoding = {
        ...execOptions,
        encoding: "utf8",
        timeout: 8_000,
        killSignal: "SIGKILL",
    };
    return new Promise((resolve, reject) => {
        const child = execFile(file, args, commandOptions, (error, stdout, stderr) => {
            signal?.removeEventListener("abort", stop);
            if (error) {
                const failure: Error = error;
                Object.assign(failure, { stdout });
                reject(failure);
            } else {
                resolve({ stdout, stderr });
            }
        });
        // Killing the child directly keeps execFile waiting for close.
        const stop = () => { child.kill("SIGKILL"); };
        signal?.addEventListener("abort", stop, { once: true });
    });
}
