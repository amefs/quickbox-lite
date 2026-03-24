import { test, expect, type Page, type TestInfo } from "@playwright/test";

const WS_BASE_URL = process.env.WS_BASE_URL || "http://127.0.0.1:8880/ws";

/**
 * Helper: switch mock profile via the WS server API.
 */
async function setMockProfile(page: Page, profile: string) {
    const response = await page.request.post(`${WS_BASE_URL}/test/profile`, {
        data: { profile },
    });
    expect(response.ok()).toBeTruthy();
}

/**
 * Helper: attach a named full-page screenshot to the test report.
 */
async function snap(page: Page, testInfo: TestInfo, name: string) {
    const screenshot = await page.screenshot({ fullPage: true });
    await testInfo.attach(name, { body: screenshot, contentType: "image/png" });
}

// ── Page loading ────────────────────────────────────────────

test.describe("Dashboard Loading", () => {
    test("should load the dashboard page successfully", async ({ page }, testInfo) => {
        await page.goto("/");
        await expect(page).toHaveTitle(/Quickbox Dashboard/i);
        await snap(page, testInfo, "dashboard-loaded");
    });

    test("should display the main panel structure", async ({ page }) => {
        await page.goto("/");
        await expect(page.locator("[data-inner-id='left-panel-container']")).toBeVisible();
        await expect(page.locator("[data-inner-id='right-panel-container']")).toBeVisible();
    });

    test("should display panel headings", async ({ page }) => {
        await page.goto("/");
        await expect(page.locator("[data-inner-id='panel-server-bandwidth-interface']")).toBeVisible();
        await expect(page.locator("[data-inner-id='panel-server-load']")).toBeVisible();
        await expect(page.locator("[data-inner-id='panel-server-cpu']")).toBeVisible();
        await expect(page.locator("[data-inner-id='panel-server-disk']")).toBeVisible();
        await expect(page.locator("[data-inner-id='panel-server-ram']")).toBeVisible();
    });

    test("should display CPU info from mock data", async ({ page }) => {
        await setMockProfile(page, "all-running");
        await page.goto("/");
        const cpuPanel = page.locator("[data-inner-id='panel-server-cpu'] .panel-body");
        await expect(cpuPanel).toContainText("Xeon", { timeout: 15_000 });
        await expect(cpuPanel).toContainText("x4", { timeout: 15_000 });
    });
});

// ── WebSocket connection ────────────────────────────────────

test.describe("WebSocket Connection", () => {
    test("should establish WebSocket connection and receive data", async ({ page }) => {
        await page.goto("/");
        await expect(page.locator("#uptime")).not.toBeEmpty({ timeout: 15_000 });
    });

    test("should display uptime from mock data", async ({ page }, testInfo) => {
        await setMockProfile(page, "all-running");
        await page.goto("/");
        const uptime = page.locator("#uptime");
        await expect(uptime).not.toBeEmpty({ timeout: 15_000 });
        // Mock uptime: 15 days 7 hours 23 minutes
        await expect(uptime).toContainText("15");
        await snap(page, testInfo, "uptime-populated");
    });

    test("should display CPU load from mock data", async ({ page }) => {
        await setMockProfile(page, "all-running");
        await page.goto("/");
        const cpuload = page.locator("#cpuload");
        await expect(cpuload).not.toBeEmpty({ timeout: 15_000 });
        // Mock loadavg: [1.52, 1.34, 1.21]
        await expect(cpuload).toContainText("1.52");
    });
});

// ── Widget rendering ────────────────────────────────────────

test.describe("Widget Rendering", () => {
    test("should render disk data widget", async ({ page }, testInfo) => {
        await page.goto("/");
        const diskData = page.locator("#disk_data");
        await expect(diskData).not.toBeEmpty({ timeout: 15_000 });
        await expect(diskData).toContainText("/");
        await snap(page, testInfo, "disk-data-widget");
    });

    test("should render RAM stats widget", async ({ page }, testInfo) => {
        await page.goto("/");
        const ramStats = page.locator("#meterram");
        await expect(ramStats).not.toBeEmpty({ timeout: 15_000 });
        expect(await ramStats.locator(".progress-bar").count()).toBeGreaterThan(0);
        await snap(page, testInfo, "ram-stats-widget");
    });

    test("should render bandwidth tables widget", async ({ page }) => {
        await page.goto("/");
        const bwTables = page.locator("#bw_tables");
        await expect(bwTables).not.toBeEmpty({ timeout: 15_000 });
        expect(await bwTables.locator("table").count()).toBeGreaterThan(0);
    });

    test("should render network speed display", async ({ page }) => {
        await page.goto("/");
        await expect(page.locator("[data-inner-id='panel-server-bandwidth-interface']")).toContainText("eth0");
    });

    test("should render service control widget", async ({ page }) => {
        await page.goto("/");
        const serviceControl = page.locator("#service_control_widget");
        await expect(serviceControl.locator("table")).toBeVisible({ timeout: 15_000 });
    });

    test("should render package management centre widget", async ({ page }, testInfo) => {
        await page.goto("/");
        const pmc = page.locator("#pmc_widget");
        await expect(pmc.locator("table")).toBeVisible({ timeout: 30_000 });
        await snap(page, testInfo, "pmc-widget");
    });
});

// ── Service status across profiles ──────────────────────────

test.describe("Service Status", () => {
    test("should show running badges for active services (all-running)", async ({ page }, testInfo) => {
        await setMockProfile(page, "all-running");
        await page.goto("/");
        const rtorrentStatus = page.locator("#appstat_rtorrent");
        await expect(rtorrentStatus.locator(".badge-service-running-dot")).toBeVisible({ timeout: 15_000 });
        await snap(page, testInfo, "all-running-services");
    });

    test("should show disabled badges for stopped services (partial-running)", async ({ page }, testInfo) => {
        await setMockProfile(page, "partial-running");
        await page.goto("/");
        const rtorrentStatus = page.locator("#appstat_rtorrent");
        await expect(rtorrentStatus.locator(".badge-service-disabled-dot")).toBeVisible({ timeout: 15_000 });

        const qbittorrentStatus = page.locator("#appstat_qbittorrent");
        await expect(qbittorrentStatus.locator(".badge-service-running-dot")).toBeVisible({ timeout: 15_000 });
        await snap(page, testInfo, "partial-running-services");
    });

    test("should show no running services in empty-system profile", async ({ page }, testInfo) => {
        await setMockProfile(page, "empty-system");
        await page.goto("/");
        const rtorrentStatus = page.locator("#appstat_rtorrent");
        const qbittorrentStatus = page.locator("#appstat_qbittorrent");
        if (await rtorrentStatus.count()) {
            await expect(rtorrentStatus.locator(".badge-service-running-dot")).toHaveCount(0);
        }
        if (await qbittorrentStatus.count()) {
            await expect(qbittorrentStatus.locator(".badge-service-running-dot")).toHaveCount(0);
        }
        await snap(page, testInfo, "empty-system-services");
    });
});

// ── Full-page overview screenshot ───────────────────────────

test.describe("Screenshots", () => {
    test("should capture full dashboard with all widgets populated", async ({ page }, testInfo) => {
        await setMockProfile(page, "all-running");
        await page.goto("/");
        // Wait for key widgets to be populated
        await expect(page.locator("#uptime")).not.toBeEmpty({ timeout: 15_000 });
        await expect(page.locator("#disk_data")).not.toBeEmpty({ timeout: 15_000 });
        await expect(page.locator("#meterram")).not.toBeEmpty({ timeout: 15_000 });
        await snap(page, testInfo, "full-dashboard-overview");
    });
});
