// SPDX-License-Identifier: GPL-3.0-or-later

import "mocha";
import { expect } from "chai";
import fs from "fs";
import path from "path";
import os from "os";

import { WatchedConfig } from "../src/shared/watched-config";

describe("watched-config", () => {
    let tmpDir: string;
    let configPath: string;
    let originalConsoleError: typeof console.error;

    beforeEach(() => {
        originalConsoleError = console.error;
        console.error = () => undefined;
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "watchedconfig-test-"));
        configPath = path.join(tmpDir, "test-config.json");
    });

    afterEach(() => {
        console.error = originalConsoleError;
        // Unwatch the file
        fs.unwatchFile(configPath);
        // Cleanup
        if (fs.existsSync(configPath)) {
            fs.rmSync(configPath);
        }
        if (fs.existsSync(tmpDir)) {
            fs.rmdirSync(tmpDir);
        }
    });

    it("should load config from file", () => {
        const data = { key: "value", num: 42 };
        fs.writeFileSync(configPath, JSON.stringify(data));

        const config = new WatchedConfig<{ key: string; num: number }>(configPath);
        expect(config.Value.key).to.equal("value");
        expect(config.Value.num).to.equal(42);
    });

    it("should handle missing file gracefully", () => {
        const missingPath = path.join(tmpDir, "missing.json");
        const config = new WatchedConfig<Record<string, unknown>>(missingPath);
        // Should not throw, config should be empty object
        expect(config.Value).to.deep.equal({});
        fs.unwatchFile(missingPath);
    });

    it("should handle invalid JSON gracefully", () => {
        fs.writeFileSync(configPath, "not valid json{{{");
        const config = new WatchedConfig<Record<string, unknown>>(configPath);
        expect(config.Value).to.deep.equal({});
    });

    it("should load nested config", () => {
        const data = {
            systemctl: {
                template: "systemctl $operation$ $target$",
                operations: ["start", "stop"],
                targets: ["nginx"],
            },
        };
        fs.writeFileSync(configPath, JSON.stringify(data));

        const config = new WatchedConfig<typeof data>(configPath);
        expect(config.Value.systemctl.template).to.equal("systemctl $operation$ $target$");
        expect(config.Value.systemctl.operations).to.have.length(2);
    });

    it("should support custom encoding", () => {
        const data = { msg: "hello" };
        fs.writeFileSync(configPath, JSON.stringify(data), "utf-8");

        const config = new WatchedConfig<typeof data>(configPath, "utf-8");
        expect(config.Value.msg).to.equal("hello");
    });

    // C3: preserve old config when reload fails
    it("should keep old config when file becomes invalid JSON", () => {
        const data = { key: "original", num: 1 };
        fs.writeFileSync(configPath, JSON.stringify(data));

        const config = new WatchedConfig<{ key: string; num: number }>(configPath);
        expect(config.Value.key).to.equal("original");

        // Now corrupt the file and force a reload via loadConfig
        fs.writeFileSync(configPath, "NOT VALID JSON{{{");
        // Access the private method via bracket notation
        (config as unknown as { loadConfig: () => void }).loadConfig();

        // Old config should be preserved
        expect(config.Value.key).to.equal("original");
        expect(config.Value.num).to.equal(1);
    });
});
