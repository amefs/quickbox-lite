// SPDX-License-Identifier: GPL-3.0-or-later
//
// Widget update ordering regressions (FE-01 / FE-02).
//
// These tests drive the dashboard served by the mock server and deliver payloads
// through the real socket "message" handler, so the assertions cover the actual
// replacement path instead of a helper function.

import { test, expect, type Page } from "@playwright/test";

import { WS_BASE_URL, resetMockProfile } from "./support/helpers";

test.beforeEach(async ({ page }) => {
    await resetMockProfile(page);
});

interface TableState {
    search: string;
    order: [number, string][];
    page: number;
    length: number;
    rowCount: number;
    visibleRows: string[];
}

interface PrefetchControl {
    bodyReady: boolean;
    releaseBody: () => void;
    consumed: Promise<void>;
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
        // DataTables only keeps the rows of the current page in the tbody, so the
        // row count reflects what the filter and paging actually produce. The
        // "no results" placeholder is a row too and must not be counted.
        const nodes = Array.from(document.querySelectorAll("#dataTable1 tbody tr"))
            .filter((node) => node.querySelector("td.dataTables_empty") === null);
        return {
            search: table.search(),
            order: table.order(),
            page: table.page(),
            length: table.page.len(),
            rowCount: nodes.length,
            visibleRows: nodes.map((node) => (node.textContent ?? "").trim()),
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
                // Bind the narrowed value: TypeScript does not carry the guard
                // into the deferred callbacks below.
                const activeSocket = socket;
                const timeout = setTimeout(() => {
                    activeSocket.off("message", handler);
                    reject(new Error(`timed out waiting for ${request.key}`));
                }, 30000);
                function handler(payload: unknown): void {
                    const message = payload as { key?: string; success?: boolean; response?: string; message?: string };
                    if (message.key !== request.key || typeof message.response !== "string") {
                        return;
                    }
                    clearTimeout(timeout);
                    activeSocket.off("message", handler);
                    resolve(message.response);
                }
                activeSocket.on("message", handler);
                activeSocket.emit("message", { key: request.key, url: request.url, locale: "en" });
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

    test("keeps the current page when refreshed widget content changes", async ({ page }) => {
        await openDashboard(page);

        if (!(await goToSecondPage(page))) {
            test.skip(true, "the package list only has a single page");
        }
        expect((await readPackageTableState(page))?.page).toBe(1);

        const html = await requestWidgetViaSocket(page, "PMC", "/node/pmc");
        const refreshedHtml = html.replace(
            'data-inner-id="panel-server-package-management"',
            'data-inner-id="panel-server-package-management" data-r7-refresh="changed"',
        );
        expect(refreshedHtml).not.toBe(html);
        expect(await deliverSocketMessage(page, {
            key: "PMC",
            success: true,
            response: refreshedHtml,
            locale: "en",
        })).toBeGreaterThan(0);

        await expect(page.locator('[data-r7-refresh="changed"]')).toHaveCount(1);
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

    for (const width of [853, 1440]) {
        test(`keeps the system panel from moving up as the package table shrinks at ${width}px`, async ({ page }) => {
            await page.setViewportSize({ width, height: 900 });
            await openDashboard(page);

            const initialTop = await page.locator('[data-inner-id="right-panel-container"]').evaluate((element) => {
                const rect = element.getBoundingClientRect();
                return rect.top + window.scrollY;
            });
            const table = page.locator("#dataTable1");
            await page.evaluate(() => {
                const win = window as unknown as { jQuery?: JQueryLike };
                const $ = win.jQuery;
                if ($ && $.fn && $.fn.DataTable) {
                    $("#dataTable1").DataTable().page("last").draw(false);
                }
            });
            await expect.poll(async () => (await readPackageTableState(page))?.page).toBe(3);
            const afterLastPage = await page.locator('[data-inner-id="right-panel-container"]').evaluate((element) => {
                const rect = element.getBoundingClientRect();
                return rect.top + window.scrollY;
            });
            expect(Math.abs(afterLastPage - initialTop)).toBeLessThanOrEqual(1);

            await page.evaluate(() => {
                const win = window as unknown as { jQuery?: JQueryLike };
                const $ = win.jQuery;
                if ($ && $.fn && $.fn.DataTable) {
                    $("#dataTable1").DataTable().search("no-such-package-layout-regression").draw();
                }
            });
            await expect(page.locator("#dataTable1 tbody td.dataTables_empty")).toBeVisible();
            const afterEmptySearch = await page.locator('[data-inner-id="right-panel-container"]').evaluate((element) => {
                const rect = element.getBoundingClientRect();
                return rect.top + window.scrollY;
            });
            expect(Math.abs(afterEmptySearch - initialTop)).toBeLessThanOrEqual(1);

            if (width === 853) {
                await page.evaluate(() => {
                    const win = window as unknown as { jQuery?: JQueryLike };
                    const $ = win.jQuery;
                    if ($ && $.fn && $.fn.DataTable) {
                        const table = $("#dataTable1").DataTable();
                        table.search("");
                        table.page.len(-1);
                        table.draw();
                    }
                });
                await expect.poll(async () => (await readPackageTableState(page))?.length).toBe(-1);
                await page.evaluate(() => {
                    const win = window as unknown as { jQuery?: JQueryLike };
                    const $ = win.jQuery;
                    if ($ && $.fn && $.fn.DataTable) {
                        const table = $("#dataTable1").DataTable();
                        table.page.len(10);
                        table.draw();
                    }
                });
                await expect.poll(async () => (await readPackageTableState(page))?.length).toBe(10);
                const afterResetPageLength = await page.locator('[data-inner-id="right-panel-container"]').evaluate((element) => {
                    const rect = element.getBoundingClientRect();
                    return rect.top + window.scrollY;
                });
                expect(Math.abs(afterResetPageLength - initialTop)).toBeLessThanOrEqual(1);

                await page.setViewportSize({ width: 1440, height: 900 });
                await expect.poll(async () => page.locator('[data-inner-id="right-panel-container"]').evaluate((element) => {
                    const rect = element.getBoundingClientRect();
                    return rect.top + window.scrollY;
                })).toBe(84);
                await page.setViewportSize({ width: 853, height: 900 });
                await expect.poll(async () => page.locator('[data-inner-id="right-panel-container"]').evaluate((element) => {
                    const rect = element.getBoundingClientRect();
                    return rect.top + window.scrollY;
                })).toBeCloseTo(initialTop, 0);
                await page.evaluate(() => {
                    const win = window as unknown as { jQuery?: JQueryLike };
                    const $ = win.jQuery;
                    if ($ && $.fn && $.fn.DataTable) {
                        $("#dataTable1").DataTable().search("no-such-package-layout-regression").draw();
                    }
                });
                await expect(page.locator("#dataTable1 tbody td.dataTables_empty")).toBeVisible();
            }

            // Replacing the widget must carry its reserved height across the new table instance.
            const freshHtml = (await requestWidgetViaSocket(page, "PMC", "/node/pmc")).replace(
                'data-inner-id="panel-server-package-management"',
                'data-inner-id="panel-server-package-management" data-layout-regression="fresh"',
            );
            expect(await deliverSocketMessage(page, { key: "PMC", success: true, response: freshHtml, locale: "en" })).toBeGreaterThan(0);
            await expect(page.locator('[data-layout-regression="fresh"]')).toHaveCount(1);
            await expect(page.locator("#dataTable1")).toBeVisible();
            await expect(page.locator("#dataTable1 tbody td.dataTables_empty")).toBeVisible();
            expect((await readPackageTableState(page))?.search).toBe("no-such-package-layout-regression");
            const afterRefresh = await page.locator('[data-inner-id="right-panel-container"]').evaluate((element) => {
                const rect = element.getBoundingClientRect();
                return rect.top + window.scrollY;
            });
            expect(Math.abs(afterRefresh - initialTop)).toBeLessThanOrEqual(1);
            await expect(table).toHaveCount(1);
        });
    }
});

test.describe("prefetch ordering", () => {
    test("a late HTTP prefetch does not overwrite data already delivered by WS", async ({ page }) => {
        await page.addInitScript(() => {
            const win = window as unknown as { prefetchControl: PrefetchControl };
            let releaseBody: () => void = () => {};
            let finish: () => void = () => {};
            const bodyGate = new Promise<void>((resolve) => { releaseBody = resolve; });
            const consumed = new Promise<void>((resolve) => { finish = resolve; });
            const control = { bodyReady: false, releaseBody, consumed };
            win.prefetchControl = control;

            const fetch = window.fetch.bind(window);
            window.fetch = async (...args: Parameters<typeof fetch>) => {
                const response = await fetch(...args);
                const input = args[0];
                const url = input instanceof Request ? input.url : String(input);
                if (!new URL(url, location.href).pathname.endsWith("/node/load")) {
                    return response;
                }

                const readText = response.text.bind(response);
                response.text = async () => {
                    const body = await readText();
                    control.bodyReady = true;
                    await bodyGate;

                    // This task runs after the released text promise and the
                    // dashboard's .then(applyPrefetchHtml) microtasks complete.
                    const checkpoint = new MessageChannel();
                    checkpoint.port1.onmessage = () => {
                        checkpoint.port1.close();
                        checkpoint.port2.close();
                        finish();
                    };
                    checkpoint.port2.postMessage(null);
                    return body;
                };
                return response;
            };
        });

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
        await expect.poll(async () => page.evaluate(() => {
            return Boolean((window as unknown as { socket?: SocketLike }).socket?.connected);
        })).toBe(true);

        // Deliver a real widget response while the HTTP prefetch is still held.
        const wsHtml = await requestWidgetViaSocket(page, "TOP", "/node/load");
        expect(wsHtml.length).toBeGreaterThan(0);
        const wsText = await page.locator("#cpuload").innerText();
        expect(wsText).not.toContain("STALE-PREFETCH");
        expect(await page.locator("#cpuload").getAttribute("data-qb-write-source")).toBeNull();

        releasePrefetch();
        await expect.poll(() => page.evaluate(() => {
            return (window as unknown as { prefetchControl: PrefetchControl }).prefetchControl.bodyReady;
        })).toBe(true);
        expect(await page.locator("#cpuload").innerText()).toBe(wsText);
        expect(await page.locator("#stale-cpu-marker").count()).toBe(0);

        await page.evaluate(async () => {
            const control = (window as unknown as { prefetchControl: PrefetchControl }).prefetchControl;
            control.releaseBody();
            await control.consumed;
        });

        expect(await page.locator("#cpuload").innerText()).toBe(wsText);
        expect(await page.locator("#stale-cpu-marker").count()).toBe(0);
    });
});

interface JQueryLike {
    (selector: string): JQueryCollection;
    fn: Record<string, { isDataTable: (selector: string) => boolean }>;
}

interface DataTableApi {
    search(): string;
    search(value: string): DataTableApi;
    order(): [number, string][];
    order(value: [number, string][]): DataTableApi;
    draw: (paging?: boolean | "page") => DataTableApi;
    page: DataTablePage;
}

interface DataTablePage {
    (): number;
    (value: number | string): DataTableApi;
    len(): number;
    len(value: number): DataTableApi;
    info: () => { pages: number };
}

interface JQueryCollection {
    DataTable: () => DataTableApi;
}

interface SocketLike {
    connected: boolean;
    listeners: (event: string) => unknown[];
    on: (event: string, listener: (payload: unknown) => void) => void;
    off: (event: string, listener: (payload: unknown) => void) => void;
    emit: (event: string, payload?: unknown) => void;
}
