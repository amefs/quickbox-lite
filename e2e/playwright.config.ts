import { defineConfig } from "@playwright/test";

const wsPort = process.env.TEST_WS_PORT || "8575";
const baseURL = process.env.E2E_BASE_URL || `http://127.0.0.1:${wsPort}`;
if (!process.env.WS_BASE_URL) {
    const wsPrefix = process.env.E2E_BASE_URL ? "/ws" : "";
    process.env.WS_BASE_URL = `${baseURL.replace(/\/+$/, "")}${wsPrefix}`;
}

export default defineConfig({
    testDir: "./tests",
    fullyParallel: false,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: 1,
    reporter: [["html", { open: "never" }], ["list"]],
    timeout: 30_000,
    use: {
        baseURL,
        trace: "on-first-retry",
        screenshot: "on",
        // No auth in test Docker setup
        httpCredentials: undefined,
    },
    projects: [
        {
            name: "chromium",
            use: {
                browserName: "chromium",
                viewport: { width: 1280, height: 800 },
            },
        },
    ],
    // Start a local mock Node server unless a caller supplied an external target.
    webServer: process.env.E2E_BASE_URL
        ? undefined
        : {
              command: "node ./scripts/mock-server.js",
              url: baseURL,
              reuseExistingServer: false,
              timeout: 60_000,
              gracefulShutdown: { signal: "SIGTERM", timeout: 2_000 },
          },
});
