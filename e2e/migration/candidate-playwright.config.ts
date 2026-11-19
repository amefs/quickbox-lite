import { defineConfig } from "@playwright/test";
import os from "node:os";
import path from "node:path";

export default defineConfig({
    testDir: __dirname,
    testMatch: ["candidate-debug.spec.ts", "candidate-functional-roundtrip.spec.ts"],
    fullyParallel: false,
    workers: 1,
    retries: 0,
    timeout: 90_000,
    expect: { timeout: 15_000 },
    globalSetup: "./candidate-server.cjs",
    reporter: "list",
    outputDir: path.join(os.tmpdir(), "quickbox-migration-candidate-output"),
    use: { browserName: "chromium", headless: true, trace: "retain-on-failure", screenshot: "only-on-failure" },
});
