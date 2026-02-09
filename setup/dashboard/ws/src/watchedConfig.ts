// SPDX-License-Identifier: GPL-3.0-or-later

import { readFileSync, watchFile } from "fs";

export class WatchedConfig<T> {
    private path: string;
    private encoding: BufferEncoding;

    private config: T;

    public constructor(path: string, encoding: BufferEncoding = "utf-8") {
        this.path = path;
        this.encoding = encoding;
        this.config = {} as T;

        this.loadConfig();
        this.watch();
    }

    public get Value(): T {
        return this.config;
    }

    private loadConfig() {
        try {
            this.config = JSON.parse(readFileSync(this.path).toString(this.encoding)) as T;
        } catch (err) {
            console.error(`Failed to load config from ${this.path}`, err);
        }
    }

    private watch() {
        watchFile(this.path, (curr, prev) => {
            if (curr.mtime > prev.mtime) {
                this.loadConfig();
                console.log(`Config reloaded at ${new Date().toISOString()}`);
            }
        });
    }
}
