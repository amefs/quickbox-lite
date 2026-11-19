import { test, expect } from "@playwright/test";

import {
    WS_BASE_URL,
    expectFocusInside,
    getRenderedWidgetText,
    resetMockProfile,
    setMockProfile,
    snap,
} from "./support/helpers";

test.beforeEach(async ({ page }) => {
    await resetMockProfile(page);
});

// ── Language switching ──────────────────────────────────────

test.describe("Language Switching", () => {
    test.afterEach(async ({ page }) => {
        // Always reset to English after each test
        await page.request.get(`${WS_BASE_URL}/set?lang=en`);
    });

    test("should switch frontend language to Chinese and inspect debug console", async ({ page }, testInfo) => {
        // Verify /set still normalizes locale for legacy callers
        const setResponse = await page.request.get(`${WS_BASE_URL}/set?lang=zh-cn`);
        expect(setResponse.ok()).toBeTruthy();
        const locale = await setResponse.text();
        expect(locale).toBe("zh");

        // Switch UI language to Chinese via pure frontend i18n
        await page.goto("/?locale=zh");
        await expect(page.locator("#service_control_widget")).toContainText("服务控制中心", { timeout: 10_000 });
        await expect(page.locator("#meterram")).toContainText("物理内存", { timeout: 10_000 });

        // Load the Ant Design debug page to verify visually
        await page.goto(`${WS_BASE_URL}/debug`);
        await page.locator("[data-url='/node/up']").click();
        await expect.poll(() => getRenderedWidgetText(page), { timeout: 10_000 }).not.toEqual("");
        await snap(page, testInfo, "language-chinese-uptime");
    });

    test("should switch frontend language to English without reload", async ({ page }, testInfo) => {
        await page.goto("/?locale=zh");
        await expect(page.locator("#service_control_widget")).toContainText("服务控制中心", { timeout: 10_000 });

        // Click English option inside header config menu (without full page reload)
        await page.evaluate(() => {
            document.querySelector<HTMLElement>("#node-language-options [data-locale='en']")?.click();
        });
        await expect(page.locator("#service_control_widget")).toContainText("Service Control Center", { timeout: 10_000 });
        await expect(page.locator("#meterram")).toContainText("Physical Memory", { timeout: 10_000 });
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

        // React renders package actions as buttons and owns their click handlers.
        const installButtons = pmc.getByRole("button", { name: "Install", exact: true });
        expect(await installButtons.count()).toBeGreaterThan(0);
        await snap(page, testInfo, "pmc-install-buttons");
    });

    test("should show remove buttons for installed packages", async ({ page }, testInfo) => {
        await page.goto("/");
        const pmc = page.locator("#pmc_widget");
        await expect(pmc.locator("table")).toBeVisible({ timeout: 30_000 });

        // Installed packages render as success buttons that open a removal confirmation modal.
        const removeButtons = pmc.locator("button.package-action-btn.btn-success");
        expect(await removeButtons.count()).toBeGreaterThan(0);
        await snap(page, testInfo, "pmc-remove-buttons");
    });

    test("should open and dismiss the removal confirmation dialog", async ({ page }, testInfo) => {
        await page.goto("/");
        const pmc = page.locator("#pmc_widget");
        await expect(pmc.locator("table")).toBeVisible({ timeout: 30_000 });

        // React owns the row selection and renders one confirmation dialog.
        const installedButtons = pmc.locator("button.package-action-btn.btn-success");
        await expect(installedButtons.first()).toBeVisible();
        await installedButtons.first().click();
        const modal = page.getByRole("dialog");
        await expect(modal).toBeVisible();
        await expect(modal).toHaveAttribute("aria-modal", "true");
        await expect(modal).toHaveAccessibleName(/Uninstall/);
        await expect(modal.getByRole("button", { name: /understand/i })).toBeVisible();
        await snap(page, testInfo, "pmc-remove-confirmation-dialog");

        // Cancelling closes the dialog and leaves the package installed.
        await modal.getByRole("button", { name: "Cancel" }).click();
        await expect(modal).toBeHidden();
        await expect(installedButtons.first()).toBeVisible();
    });

    test("should install a package via PMC without exec failure", async ({ page }, testInfo) => {
        await setMockProfile(page, "empty-system");
        await page.goto("/");
        const pmc = page.locator("#pmc_widget");
        await expect(pmc.locator("table")).toBeVisible({ timeout: 30_000 });

        const autoDlRow = pmc.locator('tr[data-row-key="autodlirssi"]');
        const autoDlInstall = autoDlRow.getByRole("button", { name: "Install", exact: true });
        await expect(autoDlInstall).toBeVisible();
        const [execResponse] = await Promise.all([
            page.evaluate(() => new Promise<{ success: boolean }>((resolve) => {
                const socket = (window as unknown as {
                    socket?: { once: (event: string, callback: (data: { success: boolean }) => void) => void };
                }).socket;
                if (!socket) {
                    throw new Error("the dashboard socket is not available");
                }
                socket.once("exec", resolve);
            })),
            autoDlInstall.click(),
        ]);
        expect(execResponse).toMatchObject({ success: true });

        const sysResponse = page.getByRole("dialog", { name: /System Response/ });
        await expect(sysResponse).toBeVisible({ timeout: 10_000 });
        await expect(sysResponse).toHaveAttribute("aria-modal", "true");
        await expectFocusInside(page, "#sysResponse");
        await expect(page.locator(".bootbox")).toHaveCount(0);

        await page.locator("#sysResponseCloseAction").click();
        await expect(autoDlRow.getByRole("button", { name: "Install", exact: true })).toHaveCount(0);
        await expect(autoDlRow.locator("button.package-action-btn.btn-success")).toBeVisible();
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

        // The migrated service controls expose accessible switch roles.
        const toggles = sc.locator('[role="switch"]');
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

test.describe("Command failure dialog", () => {
    test("should show the React alert dialog and escape failed command output", async ({ page }, testInfo) => {
        await setMockProfile(page, "partial-running");
        await page.goto("/");

        await expect.poll(() => page.evaluate(() => {
            const socket = (window as unknown as { socket?: { connected?: boolean } }).socket;
            return socket?.connected === true;
        }), { timeout: 15_000 }).toBe(true);

        // An invalid payload makes the server answer with success: false.
        // The embedded markup verifies that showAlert escapes both the message
        // and the echoed command instead of injecting it as HTML.
        const payload = "bogus:<img src=x onerror=window.__qbXss=1>";
        await page.evaluate((command) => {
            (window as unknown as { socket: { emit: (event: string, data: string) => void } }).socket.emit("exec", command);
        }, payload);

        const modal = page.getByRole("dialog", { name: /System Response/ });
        await expect(modal).toBeVisible({ timeout: 10_000 });
        await expect(modal).toHaveAttribute("aria-modal", "true");
        await expect(modal.getByRole("button", { name: "Close" })).toBeVisible();
        await expect(modal.getByRole("button", { name: "OK" })).toBeVisible();
        await expectFocusInside(page, "#quickbox-alert-modal");
        await expect(modal.locator(".ant-modal-body")).toContainText("Invalid payload");
        await expect(modal.locator(".ant-modal-body code")).toContainText(payload);
        await expect(modal.locator(".ant-modal-body img")).toHaveCount(0);
        expect(await page.evaluate(() => (window as unknown as { __qbXss?: number }).__qbXss)).toBeUndefined();
        await expect(page.locator(".bootbox")).toHaveCount(0);
        await snap(page, testInfo, "exec-failure-alert-modal");

        await modal.getByRole("button", { name: "Close" }).click();
        await expect(page.locator("#quickbox-alert-modal")).toBeHidden({ timeout: 10_000 });
    });

    test("theme selection switches on the frontend and persists across reload", async ({ page }) => {
        await page.goto("/");
        await expect(page.locator("body")).toHaveAttribute("data-theme", "defaulted");

        for (const target of ["smoked", "defaulted"] as const) {
            await page.locator("#noticePanel > button").click();
            await page.locator('#noticeDropdown a[href="#dashadjust"]').click();
            await page.locator("#node-theme-options .qb-chrome-option").filter({
                has: page.locator(`img[src="/img/themes/opt_${target}.png"]`),
            }).click();
            await expect(page.locator("body")).toHaveAttribute("data-theme", target);
            await expect(page.locator(`link[href="/css/dashboard-theme-${target}.css"]`)).toHaveCount(1);

            await page.reload({ waitUntil: "domcontentloaded" });
            await expect(page.locator("body")).toHaveAttribute("data-theme", target);
            await expect(page.locator(`link[href="/css/dashboard-theme-${target}.css"]`)).toHaveCount(1);
        }
    });

    test("package search matches smart search semantics", async ({ page }) => {
        await page.goto("/");
        await expect(page.locator("#pmc_widget tr[data-row-key]").first()).toBeVisible({ timeout: 10_000 });
        await page.locator("#quickbox-pmc-page-size").selectOption("100");
        const renderedRows = await page.locator("#pmc_widget tr[data-row-key]").evaluateAll((rows) =>
            rows.map((row) => ({
                package: row.getAttribute("data-row-key") ?? "",
                text: (row.textContent ?? "").toLocaleLowerCase(),
            })),
        );

        const smartMatch = (query: string): string[] => {
            const terms = (query.toLocaleLowerCase().match(/"[^"]+"|[^ ]+/g) ?? [])
                .map((term) => term.startsWith('"') && term.endsWith('"') ? term.slice(1, -1) : term.replace('"', ""));
            return renderedRows
                .filter((row) => terms.every((term) => row.text.includes(term)))
                .map((row) => row.package)
                .sort();
        };

        for (const query of ["", "torrents remove", '"remove torrents"', '"torrents remove"', "DELUGE", "no-such-package-123", "  file  browser "]) {
            const expected = smartMatch(query);
            await page.locator("#dataTable1-search").fill(query);
            await expect.poll(
                () => page.locator("#pmc_widget tr[data-row-key]").evaluateAll((rows) => rows.map((row) => row.getAttribute("data-row-key")).sort()),
                { message: `search ${JSON.stringify(query)}` },
            ).toEqual(expected);
        }
    });
});
