import { test, expect, type Page, type TestInfo } from "@playwright/test";

const WS_BASE_URL = process.env.WS_BASE_URL || "http://127.0.0.1:8880/ws";

async function getRenderedWidgetText(page: Page) {
    return page.locator("#result-rendered").evaluate((el) => {
        const host = el as HTMLElement;
        return host.shadowRoot?.textContent ?? "";
    });
}

async function snap(page: Page, testInfo: TestInfo, name: string) {
    const screenshot = await page.screenshot({ fullPage: true });
    await testInfo.attach(name, { body: screenshot, contentType: "image/png" });
}

test.describe("WS Debug Console", () => {
    test("should load the debug page", async ({ page }, testInfo) => {
        await page.goto(`${WS_BASE_URL}/debug`);
        await expect(page.locator("h1")).toContainText("QuickBox WS Debug Console");
        await snap(page, testInfo, "debug-console");
    });

    test("should list widget endpoints", async ({ page }) => {
        await page.goto(`${WS_BASE_URL}/debug`);
        await expect(page.locator("[data-url='/node/load.php']")).toBeVisible();
        await expect(page.locator("[data-url='/node/up.php']")).toBeVisible();
        await expect(page.locator("[data-url='/node/ram_stats.php']")).toBeVisible();
        await expect(page.locator("[data-url='/node/disk_data.php']")).toBeVisible();
    });

    test("should fetch uptime widget via debug console", async ({ page }, testInfo) => {
        await page.goto(`${WS_BASE_URL}/debug`);
        await page.locator("[data-url='/node/up.php']").click();
        const resultTitle = page.locator("#result-title");
        await expect(resultTitle).toContainText("Uptime", { timeout: 10_000 });
        await expect.poll(() => getRenderedWidgetText(page), { timeout: 10_000 }).not.toEqual("");
        await snap(page, testInfo, "debug-uptime-result");
    });

    test("should fetch load widget via debug console", async ({ page }) => {
        await page.goto(`${WS_BASE_URL}/debug`);
        await page.locator("[data-url='/node/load.php']").click();
        await expect.poll(() => getRenderedWidgetText(page), { timeout: 10_000 }).not.toEqual("");
        // Mock loadavg: "1.52 1.34 1.21"
        await expect.poll(() => getRenderedWidgetText(page), { timeout: 10_000 }).toContain("1.52");
    });

    test("should fetch RAM stats widget via debug console", async ({ page }) => {
        await page.goto(`${WS_BASE_URL}/debug`);
        await page.locator("[data-url='/node/ram_stats.php']").click();
        await expect.poll(() => getRenderedWidgetText(page), { timeout: 10_000 }).not.toEqual("");
    });

    test("should fetch disk data widget via debug console", async ({ page }, testInfo) => {
        await page.goto(`${WS_BASE_URL}/debug`);
        await page.locator("[data-url='/node/disk_data.php']").click();
        await expect.poll(() => getRenderedWidgetText(page), { timeout: 10_000 }).not.toEqual("");
        await snap(page, testInfo, "debug-disk-data-result");
    });

    test("should handle /debug/node API directly", async ({ page }) => {
        const response = await page.request.get(`${WS_BASE_URL}/debug/node?url=/node/up.php`);
        expect(response.ok()).toBeTruthy();
        const text = await response.text();
        expect(text).toContain("15"); // 15 days uptime
    });

    test("should return error for unknown widget", async ({ page }) => {
        const response = await page.request.get(`${WS_BASE_URL}/debug/node?url=/node/nonexistent.php`);
        expect(response.status()).toBe(500);
    });
});

test.describe("WS API Endpoints", () => {
    test("should return 200 for root endpoint", async ({ page }) => {
        const response = await page.request.get(`${WS_BASE_URL}/`);
        expect(response.ok()).toBeTruthy();
        const text = await response.text();
        expect(text).toContain("QuickBox Websocket");
    });

    test("should support profile switching in test mode", async ({ page }) => {
        // Switch to empty-system profile
        let response = await page.request.post(`${WS_BASE_URL}/test/profile`, {
            data: { profile: "empty-system" },
        });
        expect(response.ok()).toBeTruthy();

        // Load data reflects empty system (loadavg 0.05)
        const loadResponse = await page.request.get(`${WS_BASE_URL}/debug/node?url=/node/load.php`);
        const loadText = await loadResponse.text();
        expect(loadText).toContain("0.05");

        // Switch back
        response = await page.request.post(`${WS_BASE_URL}/test/profile`, {
            data: { profile: "all-running" },
        });
        expect(response.ok()).toBeTruthy();
    });
});
