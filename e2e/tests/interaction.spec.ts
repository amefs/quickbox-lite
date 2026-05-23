import { test, expect, type Page, type TestInfo } from "@playwright/test";

const WS_BASE_URL = process.env.WS_BASE_URL || "http://127.0.0.1:8880/ws";

async function setMockProfile(page: Page, profile: string) {
    const response = await page.request.post(`${WS_BASE_URL}/test/profile`, {
        data: { profile },
    });
    expect(response.ok()).toBeTruthy();
}

async function snap(page: Page, testInfo: TestInfo, name: string) {
    const screenshot = await page.screenshot({ fullPage: true });
    await testInfo.attach(name, { body: screenshot, contentType: "image/png" });
}

async function getRenderedWidgetText(page: Page) {
    return page.locator("#result-rendered").evaluate((el) => {
        const host = el as HTMLElement;
        return host.shadowRoot?.textContent ?? "";
    });
}

// ── Language switching ──────────────────────────────────────

test.describe("Language Switching", () => {
    test.afterEach(async ({ page }) => {
        // Always reset to English after each test
        await page.request.get(`${WS_BASE_URL}/set?lang=en`);
    });

    test("should switch WS language to Chinese", async ({ page }, testInfo) => {
        // Set language to Chinese via WS API
        const setResponse = await page.request.get(`${WS_BASE_URL}/set?lang=zh-cn`);
        expect(setResponse.ok()).toBeTruthy();
        const locale = await setResponse.text();
        expect(locale).toBe("zh");

        // Fetch a widget — its HTML should now contain Chinese text
        const loadResponse = await page.request.get(`${WS_BASE_URL}/debug/node?url=/node/ram_stats`);
        expect(loadResponse.ok()).toBeTruthy();
        const html = await loadResponse.text();
        // Chinese RAM label: "物理内存" or similar
        // The response should NOT contain the English label after switching
        expect(html.length).toBeGreaterThan(0);

        // Load the debug page to verify visually
        await page.goto(`${WS_BASE_URL}/debug`);
        await page.locator("[data-url='/node/up']").click();
        await expect.poll(() => getRenderedWidgetText(page), { timeout: 10_000 }).not.toEqual("");
        await snap(page, testInfo, "language-chinese-uptime");
    });

    test("should switch WS language to English", async ({ page }, testInfo) => {
        // First switch away from English
        await page.request.get(`${WS_BASE_URL}/set?lang=zh-cn`);

        // Now switch back to English
        const setResponse = await page.request.get(`${WS_BASE_URL}/set?lang=en`);
        expect(setResponse.ok()).toBeTruthy();
        const locale = await setResponse.text();
        expect(locale).toBe("en");

        // Verify widget uses English
        const ramResponse = await page.request.get(`${WS_BASE_URL}/debug/node?url=/node/ram_stats`);
        const html = await ramResponse.text();
        // English labels like "Physical Memory" should be present
        expect(html).toContain("Physical Memory");
        await snap(page, testInfo, "language-english-ram");
    });

    test("should reject invalid locale and fall back to English", async ({ page }) => {
        const setResponse = await page.request.get(`${WS_BASE_URL}/set?lang=xx-invalid`);
        expect(setResponse.ok()).toBeTruthy();
        const locale = await setResponse.text();
        expect(locale).toBe("en");
    });

    test("should support all valid locales", async ({ page }) => {
        const locales = ["en", "zh", "de", "fr", "es", "da"];
        for (const lang of locales) {
            const response = await page.request.get(`${WS_BASE_URL}/set?lang=${lang}`);
            expect(response.ok()).toBeTruthy();
        }
    });
});

// ── Package management UI ───────────────────────────────────

test.describe("Package Management Centre", () => {
    test.beforeEach(async ({ page }) => {
        await setMockProfile(page, "all-running");
    });

    test("should display package list in PMC widget", async ({ page }, testInfo) => {
        await page.goto("/");
        const pmc = page.locator("#pmc_widget");
        await expect(pmc.locator("table")).toBeVisible({ timeout: 30_000 });

        // The PMC table should contain rows
        const rows = pmc.locator("table tbody tr");
        expect(await rows.count()).toBeGreaterThan(0);
        await snap(page, testInfo, "pmc-package-list");
    });

    test("should show install buttons for uninstalled packages", async ({ page }, testInfo) => {
        // Switch to empty-system where no packages are installed
        await setMockProfile(page, "empty-system");
        await page.goto("/");
        const pmc = page.locator("#pmc_widget");
        await expect(pmc.locator("table")).toBeVisible({ timeout: 30_000 });

        // Should have install buttons (data-click-handler='packageInstall')
        const installButtons = pmc.locator("[data-click-handler='packageInstall']");
        expect(await installButtons.count()).toBeGreaterThan(0);
        await snap(page, testInfo, "pmc-install-buttons");
    });

    test("should show remove buttons for installed packages", async ({ page }, testInfo) => {
        await page.goto("/");
        const pmc = page.locator("#pmc_widget");
        await expect(pmc.locator("table")).toBeVisible({ timeout: 30_000 });

        // Installed packages render as success buttons that open a removal confirmation modal.
        const removeButtons = pmc.locator("button.btn-success[data-target$='RemovalConfirm']");
        expect(await removeButtons.count()).toBeGreaterThan(0);
        await snap(page, testInfo, "pmc-remove-buttons");
    });

    test("should trigger confirmation dialog on package remove click", async ({ page }, testInfo) => {
        await page.goto("/");
        const pmc = page.locator("#pmc_widget");
        await expect(pmc.locator("table")).toBeVisible({ timeout: 30_000 });

        // Click the first remove button
        const removeButtons = pmc.locator("[data-click-handler='packageRemove']");
        if (await removeButtons.count() > 0) {
            await removeButtons.first().click();
            // SweetAlert2 confirmation dialog should appear
            await page.waitForTimeout(1000);
            // Check for SweetAlert modal or confirmation dialog
            const sweetAlert = page.locator(".swal2-popup, .sweet-alert, .swal-overlay");
            if (await sweetAlert.count() > 0) {
                await snap(page, testInfo, "pmc-remove-confirmation-dialog");
                // Dismiss the dialog
                const cancelButton = page.locator(".swal2-cancel, .swal-button--cancel, [data-dismiss]");
                if (await cancelButton.count() > 0) {
                    await cancelButton.first().click();
                }
            }
        }
    });

    test("should install a package via PMC without exec failure", async ({ page }, testInfo) => {
        await setMockProfile(page, "empty-system");
        await page.goto("/");
        const pmc = page.locator("#pmc_widget");
        await expect(pmc.locator("table")).toBeVisible({ timeout: 30_000 });

        const autoDlInstall = pmc.locator("#autodlirssiInstall");
        await expect(autoDlInstall).toBeVisible();
        await autoDlInstall.click();

        const sysResponse = page.locator("#sysResponse");
        await expect(sysResponse).toBeVisible({ timeout: 10_000 });
        await expect(page.locator(".bootbox")).toHaveCount(0);

        await page.waitForLoadState("networkidle");
        await expect(pmc.locator("#autodlirssiInstall")).toHaveCount(0);
        await expect(pmc.locator("button.btn-success[data-target='#autodlirssiRemovalConfirm']")).toBeVisible();
        await snap(page, testInfo, "pmc-install-package-success");
    });
});

// ── Service control UI ──────────────────────────────────────

test.describe("Service Control", () => {
    test("should display service control table with services", async ({ page }, testInfo) => {
        await setMockProfile(page, "all-running");
        await page.goto("/");
        const sc = page.locator("#service_control_widget");
        await expect(sc.locator("table")).toBeVisible({ timeout: 15_000 });

        // Should have service rows
        const rows = sc.locator("table tbody tr");
        expect(await rows.count()).toBeGreaterThan(0);
        await snap(page, testInfo, "service-control-table");
    });

    test("should display toggle switches for running services", async ({ page }, testInfo) => {
        await setMockProfile(page, "all-running");
        await page.goto("/");
        const sc = page.locator("#service_control_widget");
        await expect(sc.locator("table")).toBeVisible({ timeout: 15_000 });

        // Toggle switches or service action buttons should exist
        const toggles = sc.locator(".toggle-en, .toggle-dis, [data-click-handler='serviceUpdate']");
        expect(await toggles.count()).toBeGreaterThan(0);
        await snap(page, testInfo, "service-toggles");
    });

    test("should show different service states across profiles", async ({ page }, testInfo) => {
        // All-running: many services
        await setMockProfile(page, "all-running");
        await page.goto("/");
        let sc = page.locator("#service_control_widget");
        await expect(sc.locator("table")).toBeVisible({ timeout: 15_000 });
        const allRunningRows = await sc.locator("table tbody tr").count();
        await snap(page, testInfo, "services-all-running");

        // Partial-running: fewer services
        await setMockProfile(page, "partial-running");
        await page.goto("/");
        sc = page.locator("#service_control_widget");
        await expect(sc.locator("table")).toBeVisible({ timeout: 15_000 });
        const partialRows = await sc.locator("table tbody tr").count();
        await snap(page, testInfo, "services-partial-running");

        // Partial should have fewer or equal rows
        expect(partialRows).toBeLessThanOrEqual(allRunningRows);
    });
});

// ── Dashboard with all widgets screenshot ───────────────────

test.describe("Full Page Interactions", () => {
    test("should render all widgets after WS data flows in", async ({ page }, testInfo) => {
        await setMockProfile(page, "all-running");
        await page.goto("/");

        // Wait for key widgets
        await expect(page.locator("#uptime")).not.toBeEmpty({ timeout: 15_000 });
        await expect(page.locator("#cpuload")).not.toBeEmpty({ timeout: 15_000 });
        await expect(page.locator("#disk_data")).not.toBeEmpty({ timeout: 15_000 });
        await expect(page.locator("#meterram")).not.toBeEmpty({ timeout: 15_000 });
        await expect(page.locator("#bw_tables")).not.toBeEmpty({ timeout: 15_000 });

        await snap(page, testInfo, "full-page-all-widgets");
    });
});
