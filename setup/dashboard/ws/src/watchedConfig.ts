import { readFileSync, watchFile } from "fs";

export class WatchedConfig<T> {
    private path: string;
    private encoding: BufferEncoding;

    private timestamp: Date;
    private config: T;

    public constructor(path: string, encoding: BufferEncoding = "utf-8") {
        this.path = path;
        this.encoding = encoding;
        this.timestamp = new Date();
        this.config = {} as T;

        this.loadConfig();
        this.watch();
    }

    public get Value(): T {
        return this.config;
    }

    private loadConfig() {
        this.config = JSON.parse(readFileSync(this.path).toString(this.encoding));
    }

    private watch() {
        watchFile(this.path, (curr, prev) => {
            if (curr.mtime > prev.mtime) {
                this.timestamp = curr.mtime;
                this.loadConfig();
                console.log(`Config reloaded at ${new Date()}`);
            }
        });
    }
}
