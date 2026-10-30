import { test, expect } from "@playwright/test";

import {
    WS_BASE_URL,
    getRenderedWidgetText,
    resetMockProfile,
    setMockProfile,
    snap,
} from "./support/helpers";

test.beforeEach(async ({ page }) => {
    await resetMockProfile(page);
});

test.describe("WS Debug Console", () => {
    test("should load the debug page", async ({ page }, testInfo) => {
        await page.goto(`${WS_BASE_URL}/debug`);
        await expect(page.locator("h1")).toContainText("QuickBox WS Debug Console");
        await snap(page, testInfo, "debug-console");
    });

    test("should list widget endpoints", async ({ page }) => {
        await page.goto(`${WS_BASE_URL}/debug`);
        await expect(page.locator("[data-url='/node/load']")).toBeVisible();
        await expect(page.locator("[data-url='/node/up']")).toBeVisible();
        await expect(page.locator("[data-url='/node/ram_stats']")).toBeVisible();
        await expect(page.locator("[data-url='/node/disk_data']")).toBeVisible();
    });

    test("should fetch uptime widget via debug console", async ({ page }, testInfo) => {
        await page.goto(`${WS_BASE_URL}/debug`);
        await page.locator("[data-url='/node/up']").click();
        const resultTitle = page.locator("#result-title");
        await expect(resultTitle).toContainText("Uptime", { timeout: 10_000 });
        await expect.poll(() => getRenderedWidgetText(page), { timeout: 10_000 }).not.toEqual("");
        await snap(page, testInfo, "debug-uptime-result");
    });

    test("should fetch load widget via debug console", async ({ page }) => {
        // The expected value is owned by the all-running profile, so it has to be
        // selected here instead of relying on whatever ran before.
        await setMockProfile(page, "all-running");
        await page.goto(`${WS_BASE_URL}/debug`);
        await page.locator("[data-url='/node/load']").click();
        await expect.poll(() => getRenderedWidgetText(page), { timeout: 10_000 }).not.toEqual("");
        // Mock loadavg: "1.52 1.34 1.21"
        await expect.poll(() => getRenderedWidgetText(page), { timeout: 10_000 }).toContain("1.52 1.34 1.21");
    });

    test("should fetch RAM stats widget via debug console", async ({ page }) => {
        await page.goto(`${WS_BASE_URL}/debug`);
        await page.locator("[data-url='/node/ram_stats']").click();
        await expect.poll(() => getRenderedWidgetText(page), { timeout: 10_000 }).not.toEqual("");
    });

    test("should fetch disk data widget via debug console", async ({ page }, testInfo) => {
        await page.goto(`${WS_BASE_URL}/debug`);
        await page.locator("[data-url='/node/disk_data']").click();
        await expect.poll(() => getRenderedWidgetText(page), { timeout: 10_000 }).not.toEqual("");
        await snap(page, testInfo, "debug-disk-data-result");
    });

    test("should handle /debug/node API directly", async ({ page }) => {
        await setMockProfile(page, "all-running");
        const response = await page.request.get(`${WS_BASE_URL}/debug/node?url=/node/up`);
        expect(response.ok()).toBeTruthy();
        const text = await response.text();
        // all-running reports 15 days of uptime.
        expect(text).toContain("<b>15</b>");
        expect(text).toContain("days");
    });

    test("should return error for unknown widget", async ({ page }) => {
        const response = await page.request.get(`${WS_BASE_URL}/debug/node?url=/node/nonexistent`);
        expect(response.status()).toBe(500);
    });
});

test.describe("WS API Endpoints", () => {
    test("should serve the selected theme through dashboard and debug asset routes", async ({ page }) => {
        await page.goto("/");
        const dashboardCss = await page.request.get(new URL("/skins/quick.css", page.url()).href);
        const debugCssUrl = `${WS_BASE_URL.replace(/\/+$/, "")}/debug/assets/skins/quick.css`;
        const debugCss = await page.request.get(debugCssUrl);

        expect(dashboardCss.status()).toBe(200);
        expect(debugCss.status()).toBe(200);
        const [dashboardBody, debugBody] = await Promise.all([dashboardCss.text(), debugCss.text()]);
        expect(dashboardBody).toContain("Quick Box UI");
        expect(debugBody).toBe(dashboardBody);
    });

    test("should return the Node dashboard at the root endpoint", async ({ page }) => {
        const response = await page.request.get(`${WS_BASE_URL}/`);
        expect(response.ok()).toBeTruthy();
        const text = await response.text();
        expect(text).toContain("<title>Quickbox Dashboard</title>");
    });

    test("should support profile switching in test mode", async ({ page }) => {
        // Switch to empty-system profile
        let response = await page.request.post(`${WS_BASE_URL}/test/profile`, {
            data: { profile: "empty-system" },
        });
        expect(response.ok()).toBeTruthy();

        // Load data reflects empty system (loadavg 0.05)
        const loadResponse = await page.request.get(`${WS_BASE_URL}/debug/node?url=/node/load`);
        const loadText = await loadResponse.text();
        expect(loadText).toContain("0.05");

        // Switch back
        response = await page.request.post(`${WS_BASE_URL}/test/profile`, {
            data: { profile: "all-running" },
        });
        expect(response.ok()).toBeTruthy();
    });
});
