// SPDX-License-Identifier: GPL-3.0-or-later
import { expect, test, type Page } from "@playwright/test";
import path from "node:path";

const origins = JSON.parse(process.env.QB_MIGRATION_ORIGINS ?? "{}") as Record<string, string>;

interface ServiceActionResult {
    service: string;
    action: string;
    success: boolean;
    phase?: string;
}

async function waitForDashboard(page: Page) {
    await expect.poll(() => page.evaluate(() => Boolean((window as any).socket?.connected))).toBe(true);
    await expect(page.locator("#pmc_widget .ant-table")).toBeVisible();
    await expect(page.locator("#service_control_widget .ant-switch").first()).toBeVisible();
}

async function performServiceAction(page: Page, service: string, action: "enable" | "disable" | "restart", click: () => Promise<void>) {
    const response = page.evaluate(({ service, action }) => new Promise<ServiceActionResult>((resolve) => {
        const socket = (window as unknown as {
            socket?: {
                on: (event: string, callback: (payload: ServiceActionResult) => void) => void;
                off: (event: string, callback: (payload: ServiceActionResult) => void) => void;
            };
        }).socket;
        if (!socket) {
            throw new Error("the dashboard socket is not available");
        }
        const onResult = (payload: ServiceActionResult) => {
            if (payload.service !== service || payload.action !== action || (payload.success && payload.phase !== "status-confirmed")) {return;}
            socket.off("service-action-result", onResult);
            resolve(payload);
        };
        socket.on("service-action-result", onResult);
    }), { service, action });
    const [result] = await Promise.all([response, click()]);
    expect(result).toMatchObject({ service, action, success: true, phase: "status-confirmed" });
}

for (const theme of ["defaulted", "smoked"]) {
    test(`${theme}: every existing service can stop, enable and restart through WebSocket`, async ({ browser }, testInfo) => {
        test.setTimeout(180_000);
        const origin = origins[theme];
        const context = await browser.newContext({ locale: "en-US", viewport: { width: 1440, height: 1000 }, reducedMotion: "reduce" });
        await context.route("**/*", (route) => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
        await context.addCookies([{ name: "quickbox_locale", value: "en", url: origin }]);
        const page = await context.newPage();
        const checked: string[] = [];
        try {
            expect((await context.request.post(`${origin}/test/profile`, { data: { profile: "all-running" } })).ok()).toBe(true);
            await page.goto(origin);
            await waitForDashboard(page);
            const ids = await page.locator('#service_control_widget [id^="appstat_"]').evaluateAll((nodes) => nodes.map((node) => node.id.slice("appstat_".length)));
            expect(ids).toHaveLength(12);
            for (const id of ids) {
                const status = page.locator(`#appstat_${id}`);
                const row = status.locator("xpath=ancestor::tr");
                const toggle = row.locator(".ant-switch");
                await expect(toggle, id).toHaveAttribute("aria-checked", "true");
                await performServiceAction(page, id, "disable", () => toggle.click());
                await expect(toggle, `${id} stopped`).toHaveAttribute("aria-checked", "false");
                await expect(status.locator(".badge-service-disabled-dot"), `${id} stopped status`).toHaveCount(1);
                await performServiceAction(page, id, "enable", () => toggle.click());
                await expect(toggle, `${id} enabled`).toHaveAttribute("aria-checked", "true");
                await expect(status.locator(".badge-service-running-dot"), `${id} running status`).toHaveCount(1);
                await performServiceAction(page, id, "restart", () => row.locator(".qb-service-refresh").click());
                await expect(toggle, `${id} restarted`).toHaveAttribute("aria-checked", "true");
                await expect(status.locator(".badge-service-running-dot"), `${id} restarted status`).toHaveCount(1);
                checked.push(id);
            }
            await testInfo.attach("service-roundtrips.json", { body: Buffer.from(JSON.stringify({ theme, checked, backend: "isolated mock", operations: ["stop+disable", "enable+restart", "refresh"] })), contentType: "application/json" });
        } finally {
            await context.request.post(`${origin}/test/profile`, { data: { profile: "all-running" } });
            await context.close();
        }
    });

    test(`${theme}: package and service operations reach the isolated mock backend and survive reload`, async ({ browser }) => {
        test.setTimeout(90_000);
        const origin = origins[theme];
        expect(origin).toBeTruthy();
        const context = await browser.newContext({ locale: "en-US", viewport: { width: 1440, height: 1000 }, reducedMotion: "reduce" });
        await context.route("**/*", (route) => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
        await context.addCookies([{ name: "quickbox_locale", value: "en", url: origin }]);
        const page = await context.newPage();
        try {
            expect((await context.request.post(`${origin}/test/profile`, { data: { profile: "all-running" } })).ok()).toBe(true);
            await page.goto(origin);
            await waitForDashboard(page);
            const notice = page.locator("#pmc_widget .alert-danger");
            await expect(notice).toBeVisible();
            await notice.getByRole("button", { name: "Close" }).click();
            await expect(notice).toHaveCount(0);

            const search = page.locator("#dataTable1-search");
            const art = page.locator('#pmc_widget tr[data-row-key="autoremovetorrents"]');
            await search.fill("torrents remove");
            await expect(art).toBeVisible();
            await search.fill('"remove torrents"');
            await expect(art).toBeVisible();
            await search.fill('"torrents remove"');
            await expect(art).toHaveCount(0);
            await search.fill("");

            const row = page.locator('#pmc_widget tr[data-row-key="autodlirssi"]');
            await expect(row.locator("button.package-action-btn")).toHaveText("Install");
            await row.locator("button.package-action-btn").click();
            await expect(page.locator("#sysResponse")).toBeVisible();
            await Promise.all([page.waitForNavigation({ waitUntil: "domcontentloaded" }), page.locator("#sysResponseCloseAction").click()]);
            await waitForDashboard(page);
            await expect(row.locator("button.package-action-btn")).toHaveText("Installed");
            await row.locator("button.package-action-btn").click();
            const confirm = page.getByRole("dialog", { name: /AutoDL/i });
            await expect(confirm).toBeVisible();
            await confirm.locator(".ant-modal-footer button").last().click();
            await expect(page.locator("#sysResponse")).toBeVisible();
            await Promise.all([page.waitForNavigation({ waitUntil: "domcontentloaded" }), page.locator("#sysResponseCloseAction").click()]);
            await waitForDashboard(page);
            await expect(row.locator("button.package-action-btn")).toHaveText("Install");

            const service = page.locator("#service_control_widget tbody > tr").first();
            const toggle = service.locator(".ant-switch");
            const before = await toggle.getAttribute("aria-checked");
            expect(["true", "false"]).toContain(before);
            const statusId = await service.locator('[id^="appstat_"]').getAttribute("id");
            expect(statusId).toBeTruthy();
            const serviceId = statusId!.slice("appstat_".length);
            const firstAction = before === "true" ? "disable" : "enable";
            await performServiceAction(page, serviceId, firstAction, () => toggle.click());
            await expect(toggle).toHaveAttribute("aria-checked", before === "true" ? "false" : "true");
            await performServiceAction(page, serviceId, firstAction === "disable" ? "enable" : "disable", () => toggle.click());
            await expect(toggle).toHaveAttribute("aria-checked", before!);
        } finally {
            await context.request.post(`${origin}/test/profile`, { data: { profile: "all-running" } });
            await context.close();
        }
    });
}

test("theme selection persists through the isolated backend and reloads each theme", async ({ browser }) => {
    const origin = origins.defaulted;
    const context = await browser.newContext({ locale: "en-US", viewport: { width: 1440, height: 1000 }, reducedMotion: "reduce" });
    await context.route("**/*", (route) => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    await context.addCookies([{ name: "quickbox_locale", value: "en", url: origin }]);
    const page = await context.newPage();
    try {
        await page.goto(origin);
        await waitForDashboard(page);
        await expect(page.locator("body")).toHaveAttribute("data-theme", "defaulted");
        for (const target of ["smoked", "defaulted"]) {
            await page.locator("#noticePanel > button").click();
            await page.locator('#noticeDropdown a[href="#dashadjust"]').click();
            await page.locator("#node-theme-options .qb-chrome-option").filter({
                has: page.locator(`img[src="/img/themes/opt_${target}.png"]`),
            }).click();
            const dialog = page.locator(`#themeSelect${target}Confirm`);
            await expect(dialog).toBeVisible();
            const response = page.waitForResponse((item) => item.url() === `${origin}/node/theme` && item.request().method() === "POST");
            await Promise.all([page.waitForNavigation({ waitUntil: "domcontentloaded" }), page.locator(`#themeSelect${target}Go`).click()]);
            expect((await response).status()).toBe(200);
            await waitForDashboard(page);
            await expect(page.locator("body")).toHaveAttribute("data-theme", target);
            await expect(page.locator(`link[href="/css/dashboard-theme-${target}.css"]`)).toHaveCount(1);
        }
    } finally {
        await context.close();
    }
});

test("package search matches the legacy DataTables smart search", async ({ browser }) => {
    const origin = origins.defaulted;
    const context = await browser.newContext({ locale: "en-US", viewport: { width: 1440, height: 1000 } });
    await context.route("**/*", (route) => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    await context.addCookies([{ name: "quickbox_locale", value: "en", url: origin }]);
    const page = await context.newPage();
    const legacy = await context.newPage();
    try {
        expect((await context.request.post(`${origin}/test/profile`, { data: { profile: "all-running" } })).ok()).toBe(true);
        await page.goto(origin);
        await waitForDashboard(page);
        await page.locator("#quickbox-pmc-page-size").selectOption("100");
        const fixture = await page.evaluate(() => (window as any).quickboxRuntime.packageManagement);
        await legacy.setContent("<table id='legacy'><thead><tr><th>Name</th><th>Details</th><th>Availability</th></tr></thead><tbody></tbody></table>");
        await legacy.addScriptTag({ path: path.resolve(__dirname, "../../setup/dashboard/lib/jquery/jquery.min.js") });
        await legacy.addScriptTag({ path: path.resolve(__dirname, "../../setup/dashboard/lib/datatables/js/jquery.dataTables.min.js") });
        await legacy.evaluate(({ data, labels }) => {
            const body = document.querySelector("#legacy tbody")!;
            for (const row of data.rows) {
                const tr = document.createElement("tr");
                tr.dataset.key = row.package;
                for (const value of [row.name, row.descriptionText, row.installed ? labels.installed : row.boxOnly ? labels.box : labels.install]) {
                    const cell = document.createElement("td");
                    cell.textContent = value;
                    tr.appendChild(cell);
                }
                body.appendChild(tr);
            }
            (window as any).jQuery("#legacy").DataTable({ pageLength: 100 });
        }, fixture);
        for (const query of ["", "torrents remove", '"remove torrents"', '"torrents remove"', "DELUGE", "no-such-package-123", "  file  browser "]) {
            const expected = await legacy.evaluate((value) => {
                const table = (window as any).jQuery("#legacy").DataTable();
                table.search(value).draw();
                return table.rows({ search: "applied" }).nodes().toArray().map((row: HTMLElement) => row.dataset.key).sort();
            }, query);
            await page.locator("#dataTable1-search").fill(query);
            await expect.poll(() => page.locator("#pmc_widget tr[data-row-key]").evaluateAll((rows) => rows.map((row) => row.getAttribute("data-row-key")).sort()), { message: `search ${JSON.stringify(query)}` }).toEqual(expected);
        }
    } finally {
        await context.request.post(`${origin}/test/profile`, { data: { profile: "all-running" } });
        await context.close();
    }
});
