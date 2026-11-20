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

    test("localizes package table controls, result counts and empty results", async ({ page }) => {
        await page.goto("/?locale=zh");
        const table = page.locator("#pmc_widget");
        const search = table.getByRole("textbox", { name: "搜索：" });
        const pageSize = table.getByRole("combobox", { name: "每页条数" });
        const status = table.getByRole("status");
        await expect(pageSize).toHaveValue("10");
        await expect(status).toHaveText(/显示第 1 至 10 条，共 \d+ 条记录/);
        await expect(table.getByRole("link", { name: "第 2 页" })).toBeVisible();
        await expect(table.getByRole("link", { name: "下一页" })).toBeVisible();

        await search.fill("no-such-package-123");
        await expect(status).toHaveText("共 0 条记录");
        await expect(table.getByText("未找到匹配的记录。")).toBeVisible();

        await page.locator("#node-language-options [data-locale='fr']").evaluate((element) => (element as HTMLElement).click());
        await expect(table.getByRole("textbox", { name: "Rechercher :" })).toHaveValue("no-such-package-123");
        await expect(table.getByRole("combobox", { name: "Entrées par page" })).toHaveValue("10");
        await expect(status).toHaveText("0 entrée");
        await expect(table.getByText("Aucun résultat ne correspond à la recherche.")).toBeVisible();
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
        await page.locator("[data-url='/node/data/system_uptime']").click();
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

    test("uses the server language without saving it as a browser preference", async ({ page }) => {
        await page.addInitScript(() => {
            Object.defineProperty(navigator, "language", { value: "de-DE" });
        });
        await setMockProfile(page, "server-locale-zh");
        const bootstrap = await page.request.get(`${WS_BASE_URL}/node/bootstrap`);
        expect(await bootstrap.json()).toMatchObject({ defaultLocale: "zh" });

        await page.goto("/");
        await expect(page.locator("html")).toHaveAttribute("lang", "zh");
        await expect(page.locator("#service_control_widget")).toContainText("服务控制中心");
        expect((await page.context().cookies()).map((cookie) => cookie.name)).not.toContain("quickbox_locale");

        await page.goto(`${WS_BASE_URL}/debug`);
        await expect(page.locator("html")).toHaveAttribute("lang", "zh");

        await resetMockProfile(page);
        const unconfigured = await page.request.get(`${WS_BASE_URL}/node/bootstrap`);
        expect(await unconfigured.json()).toMatchObject({ defaultLocale: null });
        await page.goto("/");
        await expect(page.locator("#pmc_widget table")).toBeVisible();
        await expect(page.locator("html")).toHaveAttribute("lang", "de");
    });

    test("prefers an explicit URL language and remembers a language selected in the dashboard", async ({ page }) => {
        await setMockProfile(page, "server-locale-zh");
        await page.goto("/?lang=fr");
        await expect(page.locator("#pmc_widget table")).toBeVisible();
        await expect(page.locator("html")).toHaveAttribute("lang", "fr");
        expect((await page.context().cookies()).map((cookie) => cookie.name)).not.toContain("quickbox_locale");

        await page.goto("/");
        await expect(page.locator("#service_control_widget")).toContainText("服务控制中心");
        await page.locator("#node-language-options [data-locale='en']").evaluate((item) => (item as HTMLElement).click());
        await expect(page.locator("#service_control_widget")).toContainText("Service Control Center");
        const chosen = (await page.context().cookies()).find((cookie) => cookie.name === "quickbox_locale");
        expect(chosen?.value).toBe("en");
        expect(chosen?.expires).toBeGreaterThan(Date.now() / 1000);

        await page.goto("/?locale=de");
        await expect(page.locator("#pmc_widget table")).toBeVisible();
        await expect(page.locator("html")).toHaveAttribute("lang", "de");
        await page.goto("/");
        await expect(page.locator("#service_control_widget")).toContainText("Service Control Center");
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
            await expect(page.locator('link[href*="/css/dashboard-theme.css"]')).toHaveCount(1);
            await expect(page.locator(".panel").first()).toHaveCSS(
                "background-color",
                target === "smoked" ? "rgb(34, 34, 34)" : "rgb(255, 255, 255)",
            );

            await page.reload({ waitUntil: "domcontentloaded" });
            await expect(page.locator("body")).toHaveAttribute("data-theme", target);
            await expect(page.locator('link[href*="/css/dashboard-theme.css"]')).toHaveCount(1);
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

    test("package management toolbar and table remain usable on a narrow screen", async ({ page }) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await page.goto("/?locale=zh");
        await expect(page.locator("#pmc_widget tr[data-row-key]").first()).toBeVisible({ timeout: 10_000 });
        const toolbar = page.locator(".qb-package-management__toolbar");
        const scroller = page.locator(".qb-package-management__table-scroll");
        const toolbarIsStacked = () => toolbar.evaluate((element) => {
            const [pageSize, search] = element.querySelectorAll("label");
            return search.getBoundingClientRect().top >= pageSize.getBoundingClientRect().bottom;
        });
        const layout = await page.evaluate(() => {
            const filter = document.querySelector<HTMLElement>(".qb-package-management__search")!;
            const input = document.querySelector<HTMLInputElement>("#dataTable1-search")!;
            const container = document.querySelector<HTMLElement>(".qb-package-management__table-scroll")!;
            const table = container.querySelector("table")!;
            const detail = document.querySelector<HTMLElement>("#pmc_widget .ant-table-tbody > tr > td:nth-child(2)")!;
            return {
                filterWidth: filter.getBoundingClientRect().width,
                inputWidth: input.getBoundingClientRect().width,
                tableWidth: table.getBoundingClientRect().width,
                viewportWidth: container.clientWidth,
                scrollWidth: container.scrollWidth,
                detailWrap: getComputedStyle(detail).overflowWrap,
            };
        });
        await expect.poll(toolbarIsStacked).toBe(true);
        expect(layout.inputWidth).toBeGreaterThan(200);
        expect(layout.inputWidth).toBeLessThan(layout.filterWidth);
        expect(layout.tableWidth).toBeGreaterThan(layout.viewportWidth);
        expect(layout.scrollWidth).toBeGreaterThan(layout.viewportWidth);
        expect(layout.detailWrap).toBe("anywhere");
        await scroller.evaluate((element) => { element.scrollLeft = element.scrollWidth; });
        expect(await scroller.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);

        await page.setViewportSize({ width: 1440, height: 900 });
        await expect.poll(toolbarIsStacked).toBe(false);
        await expect.poll(() => scroller.evaluate((element) => element.scrollWidth - element.clientWidth)).toBe(0);
        const [name, details, availability] = await scroller.locator("thead th").evaluateAll((cells) =>
            cells.map((cell) => cell.getBoundingClientRect().width),
        );
        const total = name + details + availability;
        expect(name / total).toBeCloseTo(0.15, 2);
        expect(details / total).toBeGreaterThan(0.7);

        await page.setViewportSize({ width: 390, height: 844 });
        await expect.poll(toolbarIsStacked).toBe(true);
        await expect.poll(() => scroller.evaluate((element) => element.scrollWidth - element.clientWidth)).toBeGreaterThan(0);
    });
});
