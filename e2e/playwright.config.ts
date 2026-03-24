import { defineConfig } from "@playwright/test";

const baseURL = process.env.E2E_BASE_URL || "http://127.0.0.1:8880";

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
    // Wait for the Docker services to be ready
    webServer: process.env.E2E_BASE_URL
        ? undefined
        : {
              command: "sh -c 'docker compose up -d nginx && trap \"exit 0\" INT TERM; while :; do sleep 3600; done'",
              url: baseURL,
              reuseExistingServer: true,
              timeout: 60_000,
          },
});
