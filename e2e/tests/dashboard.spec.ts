import { test, expect } from "@playwright/test";

import { resetMockProfile, setMockProfile, snap } from "./support/helpers";

test.beforeEach(async ({ page }) => {
    await resetMockProfile(page);
});

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

test("shows available branches and starts a branch update", async ({ page }) => {
    await page.route("**/node/branches?*", async route => {
        await route.fulfill({ json: { branches: ["master", "development", "feature/example"] } });
    });
    await page.goto("/?locale=en");
    await page.locator(".header-account button").click();
    await page.locator('a[data-branch-mode="other"]').click();
    await expect(page.locator("#branchTarget option")).toHaveCount(4);
    await page.locator("#branchTarget").selectOption("feature/example");
    await page.locator("#branchSwitchGo").click();
    await expect(page.locator("#sysResponse")).toBeVisible();
    await expect.poll(async () => (await page.request.get("/node/dashboard_config")).json()).toMatchObject({ branch: "feature/example" });
});

test("recommended branches open confirmation without loading the branch list", async ({ page }) => {
    let branchRequests = 0;
    await page.route("**/node/branches?*", async route => {
        branchRequests += 1;
        await route.abort();
    });
    await page.goto("/?locale=en");
    await page.locator(".header-account button").click();
    await expect(page.locator('a[data-branch-mode="master"]')).toHaveCount(0);
    await page.locator('a[data-branch-mode="development"]').click();
    await expect(page.locator("#branchFixedTarget")).toHaveText("development");
    await expect(page.locator("#branchTarget")).toBeHidden();
    await expect(page.locator("#branchSwitchGo")).toBeEnabled();
    expect(branchRequests).toBe(0);
    await page.locator("#branchSwitch .modal-footer [data-dismiss=modal]").click();
    await expect(page.locator("#branchSwitch")).toBeHidden();
    await expect.poll(async () => (await page.request.get("/node/dashboard_config")).json()).toMatchObject({ branch: "master" });
    await page.locator(".header-account button").click();
    await page.locator('a[data-branch-mode="development"]').click();
    await page.locator("#branchSwitchGo").click();
    await expect.poll(async () => (await page.request.get("/node/dashboard_config")).json()).toMatchObject({ branch: "development" });
    await page.goto("/?locale=en");
    await page.locator(".header-account button").click();
    await expect(page.locator('a[data-branch-mode="development"]')).toHaveCount(0);
    await page.locator('a[data-branch-mode="master"]').click();
    await expect(page.locator("#branchFixedTarget")).toHaveText("master");
    await page.locator("#branchSwitchGo").click();
    await expect.poll(async () => (await page.request.get("/node/dashboard_config")).json()).toMatchObject({ branch: "master" });
    expect(branchRequests).toBe(0);
});

test("a custom branch offers both recommended targets", async ({ page }) => {
    await setMockProfile(page, "long-branch");
    await page.goto("/?locale=en");
    await page.locator(".header-account button").click();
    await expect(page.locator('a[data-branch-mode="master"]')).toBeVisible();
    await expect(page.locator('a[data-branch-mode="development"]')).toBeVisible();
    await expect(page.locator('a[data-branch-mode="other"]')).toBeVisible();
});

test("branch list failure can be retried", async ({ page }) => {
    let retryAllowed = false;
    await page.route("**/node/branches?*", async route => {
        if (!retryAllowed) {
            await route.fulfill({ status: 503, contentType: "application/json", body: "{}" });
        } else {
            await route.fulfill({ json: { branches: ["master", "development"] } });
        }
    });
    await page.goto("/?locale=en");
    await page.locator(".header-account button").click();
    await page.locator('a[data-branch-mode="other"]').click();
    await expect(page.locator("#branchError")).toBeVisible();
    await expect(page.locator("#branchTarget option")).toHaveText("Unable to load branches");
    await expect(page.locator("#branchSwitchGo")).toBeDisabled();
    retryAllowed = true;
    await page.locator("#branchRetry").click();
    await expect(page.locator("#branchError")).toBeHidden();
    await expect(page.locator("#branchTarget")).toHaveValue("master");
    await expect(page.locator("#branchSwitchGo")).toHaveText("Update");
    await page.locator("#branchTarget").selectOption("development");
    await expect(page.locator("#branchSwitchGo")).toHaveText("Switch and update");
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
        // The widget is server-rendered with skeleton tables first, so waiting
        // for the table itself would accept the placeholder as loaded content.
        await expect(bwTables.locator(".qb-skeleton")).toHaveCount(0, { timeout: 15_000 });
        await expect(bwTables.locator("table").nth(1).locator("tbody tr").first()).toBeVisible();
        expect(await bwTables.locator("table").nth(1).locator("tbody tr td").first().innerText()).not.toBe("");
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

// ── Bandwidth page switch ───────────────────────────────────

test.describe("Bandwidth Page", () => {
    test("switching the page refreshes the widget without reloading", async ({ page }) => {
        await page.goto("/");
        const bwTables = page.locator("#bw_tables");
        const pageTable = bwTables.locator("table").nth(1);
        // The initial ready-made HTML contains two skeleton tables, so waiting
        // for a visible table would read the placeholder caption (empty) and
        // race against the first WebSocket update.
        await expect(bwTables.locator(".qb-skeleton")).toHaveCount(0, { timeout: 15_000 });

        // The widget renders two tables: a fixed summary, then the one that
        // belongs to the selected page. The second caption carries the page name.
        const pageCaption = pageTable.locator("th").first();
        const previousCaption = (await pageCaption.innerText()).trim();
        expect(previousCaption.length).toBeGreaterThan(0);
        const documentId = await page.evaluate(() => performance.timeOrigin);

        // The options live in the header panel's "configure" tab, which is not
        // open: click the element itself so the assertion covers the handler and
        // the polling path instead of the panel's visibility.
        await page.evaluate(() => {
            const options = Array.from(document.querySelectorAll("#node-bw-page-options div")) as HTMLElement[];
            // dashboardBandwidthPages order: t, h, d, m — "d" is the third one.
            options[2]?.click();
        });

        // The caption proves the widget itself re-fetched with the new page: the
        // poll runs every 60 s, so a change within seconds has to come from the
        // click, not from the timer.
        await expect
            .poll(async () => (await pageCaption.innerText()).trim(), { timeout: 5_000 })
            .not.toBe(previousCaption);
        expect(await page.evaluate(() => localStorage.getItem("bw_tables:page"))).toBe("d");
        // "Refresh the data" must stay a data operation: same document, so the
        // scroll position and every other widget survive the switch.
        expect(await page.evaluate(() => performance.timeOrigin)).toBe(documentId);
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

        // Anchor on the widget itself: with no installed packages the per-package
        // `#appstat_*` badges may be absent, so "no running dot" is only
        // meaningful once the service table is known to have rendered.
        const serviceControl = page.locator("#service_control_widget");
        await expect(serviceControl).toBeVisible({ timeout: 15_000 });
        await expect(serviceControl.locator(".badge-service-running-dot")).toHaveCount(0);
        await expect(page.locator("[id^='appstat_'] .badge-service-running-dot")).toHaveCount(0);
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
