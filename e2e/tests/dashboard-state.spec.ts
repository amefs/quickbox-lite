// SPDX-License-Identifier: GPL-3.0-or-later
//
// Widget update ordering regressions (FE-01 / FE-02).
//
// These tests drive the dashboard served by the mock server and deliver payloads
// through the real socket "message" handler, so the assertions cover the actual
// replacement path instead of a helper function.

import { test, expect, type Page } from "@playwright/test";

const WS_BASE_URL = process.env.WS_BASE_URL || `http://127.0.0.1:${process.env.TEST_WS_PORT || "8575"}`;

interface TableState {
    search: string;
    order: [number, string][];
    page: number;
    length: number;
    rowCount: number;
    visibleRows: string[];
}

async function isPackageTableReady(page: Page): Promise<boolean> {
    return page.evaluate(() => {
        const win = window as unknown as { jQuery?: JQueryLike };
        const $ = win.jQuery;
        return Boolean($ && $.fn && $.fn.DataTable && $.fn.DataTable.isDataTable("#dataTable1"));
    });
}

async function readPackageTableState(page: Page): Promise<TableState | null> {
    return page.evaluate(() => {
        const win = window as unknown as { jQuery?: JQueryLike };
        const $ = win.jQuery;
        if (!$ || !$.fn || !$.fn.DataTable || !$.fn.DataTable.isDataTable("#dataTable1")) {
            return null;
        }
        const table = $("#dataTable1").DataTable();
        const nodes = document.querySelectorAll("#dataTable1 tbody tr");
        return {
            search: table.search(),
            order: table.order(),
            page: table.page(),
            length: table.page.len(),
            rowCount: document.querySelectorAll("#dataTable1").length,
            visibleRows: Array.from(nodes).map((node) => (node.textContent ?? "").trim()),
        };
    });
}

async function setPackageTableState(page: Page, search: string, order: [number, string]): Promise<void> {
    await page.evaluate(
        (payload) => {
            const win = window as unknown as { jQuery?: JQueryLike };
            const $ = win.jQuery;
            if (!$ || !$.fn || !$.fn.DataTable || !$.fn.DataTable.isDataTable("#dataTable1")) {
                return;
            }
            const table = $("#dataTable1").DataTable();
            table.search(payload.search);
            table.order([payload.order] as [number, string][]);
            table.draw(false);
        },
        { search, order },
    );
}

async function goToSecondPage(page: Page): Promise<boolean> {
    return page.evaluate(() => {
        const win = window as unknown as { jQuery?: JQueryLike };
        const $ = win.jQuery;
        if (!$ || !$.fn || !$.fn.DataTable || !$.fn.DataTable.isDataTable("#dataTable1")) {
            return false;
        }
        const table = $("#dataTable1").DataTable();
        const info = table.page.info();
        if (info.pages < 2) {
            return false;
        }
        table.page(1).draw(false);
        return true;
    });
}

async function deliverSocketMessage(page: Page, payload: unknown): Promise<number> {
    return page.evaluate((data) => {
        const socket = (window as unknown as { socket?: SocketLike }).socket;
        if (!socket || typeof socket.listeners !== "function") {
            return 0;
        }
        const listeners = socket.listeners("message") as ((message: unknown) => void)[];
        for (const listener of listeners) {
            listener(data);
        }
        return listeners.length;
    }, payload);
}

/**
 * Requests a widget payload over the real socket. `/node/pmc` is not exposed over
 * HTTP, so the payload has to come from the WS transport, which also makes the
 * dashboard replace the widget through its normal handler.
 */
async function requestWidgetViaSocket(page: Page, key: string, url: string): Promise<string> {
    return page.evaluate(
        (request) =>
            new Promise<string>((resolve, reject) => {
                const socket = (window as unknown as { socket?: SocketLike }).socket;
                if (!socket) {
                    reject(new Error("socket is not available"));
                    return;
                }
                const timeout = setTimeout(() => {
                    socket.off("message", handler);
                    reject(new Error(`timed out waiting for ${request.key}`));
                }, 30000);
                function handler(payload: unknown): void {
                    const message = payload as { key?: string; success?: boolean; response?: string; message?: string };
                    if (message.key !== request.key || typeof message.response !== "string") {
                        return;
                    }
                    clearTimeout(timeout);
                    socket.off("message", handler);
                    resolve(message.response);
                }
                socket.on("message", handler);
                socket.emit("message", { key: request.key, url: request.url, locale: "en" });
            }),
        { key, url },
    );
}

async function openDashboard(page: Page): Promise<void> {
    await page.goto(WS_BASE_URL);
    // The package table is only built once the widget HTML and DataTables are
    // both available; the widget body itself may stay collapsed until then.
    await expect.poll(async () => isPackageTableReady(page), { timeout: 60000 }).toBe(true);
}

test.describe("PMC widget state", () => {
    test.setTimeout(120000);

    test("keeps search, sort and instance across a WS replacement", async ({ page }) => {
        await openDashboard(page);

        await setPackageTableState(page, "deluge", [0, "desc"]);
        await expect.poll(async () => (await readPackageTableState(page))?.search).toBe("deluge");

        const before = await readPackageTableState(page);
        expect(before).not.toBeNull();
        if (before === null) {
            return;
        }
        expect(before.order[0]?.[1]).toBe("desc");
        expect(before.rowCount).toBe(1);

        // Triggering the widget over the WS makes the dashboard replace the DOM
        // through its normal handler, which is the path under test.
        const html = await requestWidgetViaSocket(page, "PMC", "/node/pmc");
        expect(html.length).toBeGreaterThan(0);

        const after = await readPackageTableState(page);
        expect(after).not.toBeNull();
        if (after === null) {
            return;
        }
        expect(after.search).toBe("deluge");
        expect(after.order[0]?.[1]).toBe("desc");
        expect(after.length).toBe(before.length);
        expect(after.rowCount).toBe(1);

        // The filter must be re-applied to the fresh markup.
        expect(after.visibleRows.length).toBeGreaterThan(0);
        for (const row of after.visibleRows) {
            expect(row.toLowerCase()).toContain("deluge");
        }

        // No leftover or duplicated instance after the replacement.
        await expect(page.locator("#dataTable1")).toHaveCount(1);
        await expect(page.locator(".dataTables_wrapper")).toHaveCount(1);
    });

    test("keeps the current page when the widget content is unchanged", async ({ page }) => {
        await openDashboard(page);

        if (!(await goToSecondPage(page))) {
            test.skip(true, "the package list only has a single page");
        }
        expect((await readPackageTableState(page))?.page).toBe(1);

        await requestWidgetViaSocket(page, "PMC", "/node/pmc");
        // The second identical payload hits the unchanged-HTML shortcut.
        await requestWidgetViaSocket(page, "PMC", "/node/pmc");

        expect((await readPackageTableState(page))?.page).toBe(1);
        await expect(page.locator(".dataTables_wrapper")).toHaveCount(1);
    });

    test("clamps the page when the refreshed data has fewer pages", async ({ page }) => {
        await openDashboard(page);

        const html = await requestWidgetViaSocket(page, "PMC", "/node/pmc");
        if (!(await goToSecondPage(page))) {
            test.skip(true, "the package list only has a single page");
        }
        expect((await readPackageTableState(page))?.page).toBe(1);

        const singlePage = await page.evaluate((markup) => {
            const host = document.createElement("div");
            host.innerHTML = markup;
            const body = host.querySelector("#dataTable1 tbody");
            if (!body) {
                return markup;
            }
            const rows = Array.from(body.querySelectorAll("tr"));
            rows.slice(1).forEach((row) => {
                row.remove();
            });
            return host.innerHTML;
        }, html);

        await deliverSocketMessage(page, { key: "PMC", success: true, response: singlePage, locale: "en" });

        expect((await readPackageTableState(page))?.page).toBe(0);
        await expect(page.locator(".dataTables_wrapper")).toHaveCount(1);
    });
});

test.describe("prefetch ordering", () => {
    test("a late HTTP prefetch does not overwrite data already delivered by WS", async ({ page }) => {
        let releasePrefetch: () => void = () => {};
        const prefetchGate = new Promise<void>((resolve) => {
            releasePrefetch = resolve;
        });

        await page.route("**/node/load*", async (route) => {
            await prefetchGate;
            await route.fulfill({
                status: 200,
                contentType: "text/html",
                body: "<span id='stale-cpu-marker'>STALE-PREFETCH</span>",
            });
        });

        await page.goto(WS_BASE_URL);

        // The WebSocket payload must land first and record its source.
        await expect(page.locator("#cpuload")).toHaveAttribute("data-qb-write-source", "ws", { timeout: 20000 });
        const wsText = await page.locator("#cpuload").innerText();
        expect(wsText).not.toContain("STALE-PREFETCH");

        releasePrefetch();
        await page.waitForTimeout(1000);

        expect(await page.locator("#cpuload").innerText()).toBe(wsText);
        expect(await page.locator("#cpuload").getAttribute("data-qb-write-source")).toBe("ws");
        expect(await page.locator("#stale-cpu-marker").count()).toBe(0);
    });
});

interface JQueryLike {
    (selector: string): JQueryCollection;
    fn: Record<string, { isDataTable?: (selector: string) => boolean }>;
}

interface DataTableApi {
    search: (value?: string) => string;
    order: (value?: [number, string][]) => [number, string][];
    draw: (paging?: boolean) => DataTableApi;
    page: ((value?: number) => number) & { len: () => number; info: () => { pages: number } };
}

interface JQueryCollection {
    DataTable: () => DataTableApi;
}

interface SocketLike {
    listeners: (event: string) => unknown[];
}
