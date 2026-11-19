// SPDX-License-Identifier: GPL-3.0-or-later
//
// Widget update ordering regressions (FE-01 / FE-02).
//
// These tests drive the dashboard served by the mock server and deliver payloads
// through the real socket "message" handler, so the assertions cover the actual
// replacement path.

import { test, expect, type Page } from "@playwright/test";

import { WS_BASE_URL, resetMockProfile } from "./support/helpers";

test.beforeEach(async ({ page }) => {
    await resetMockProfile(page);
});

interface TableState {
    search: string;
    sort: string | null;
    page: number;
    length: number;
    rowCount: number;
    visibleRows: string[];
}

interface ServiceStatusRequestFixture {
    protocolVersion: 2;
    key: "SERVICE_STATUS_ALL";
    url: string;
    requestId: string;
    locale: string;
    generation: number;
}

interface ServiceControlRequestFixture {
    protocolVersion: 2;
    key: "SERVICE_CONTROL";
    url: string;
    requestId: string;
    locale: string;
    generation: number;
}

interface NetworkRequestFixture {
    key: "NETWORK";
    url: string;
    requestId: string;
}

interface PrefetchControl {
    bodyReady: boolean;
    releaseBody: () => void;
    consumed: Promise<void>;
}

async function isPackageTableReady(page: Page): Promise<boolean> {
    return page.evaluate(() => {
        const win = window as unknown as { quickboxPackageManagementIsland?: { onMessage?: unknown } };
        return typeof win.quickboxPackageManagementIsland?.onMessage === "function" &&
            document.querySelector("#pmc_widget #dataTable1-search") !== null &&
            document.querySelector("#pmc_widget .ant-table-tbody") !== null;
    });
}

async function readPackageTableState(page: Page): Promise<TableState | null> {
    return page.evaluate(() => {
        const search = document.querySelector<HTMLInputElement>("#dataTable1-search");
        const pageSize = document.querySelector<HTMLSelectElement>("#quickbox-pmc-page-size");
        const body = document.querySelector("#pmc_widget .ant-table-tbody");
        if (!search || !pageSize || !body) {
            return null;
        }
        const nodes = Array.from(body.querySelectorAll<HTMLTableRowElement>("tr[data-row-key]"));
        const currentPage = document.querySelector('#dataTable1_paginate a[aria-current="page"]');
        return {
            search: search.value,
            sort: document.querySelector("#pmc_widget .ant-table-thead th[aria-sort]")?.getAttribute("aria-sort") ?? null,
            page: Number.parseInt(currentPage?.textContent ?? "1", 10) - 1,
            length: Number.parseInt(pageSize.value, 10),
            rowCount: nodes.length,
            visibleRows: nodes.map((node) => (node.textContent ?? "").trim()),
        };
    });
}

async function setPackageTableState(page: Page, search: string, order: [number, "asc" | "desc"]): Promise<void> {
    await page.locator("#dataTable1-search").fill(search);
    const sortHeader = page.locator("#pmc_widget .ant-table-thead th").nth(order[0]);
    const desiredSort = order[1] === "desc" ? "descending" : "ascending";
    if (await sortHeader.getAttribute("aria-sort") !== desiredSort) {
        await sortHeader.click();
    }
    await expect(sortHeader).toHaveAttribute("aria-sort", desiredSort);
}

async function goToSecondPage(page: Page): Promise<boolean> {
    const pageTwo = page.locator('#dataTable1_paginate a[aria-label="Page 2"]');
    if (await pageTwo.count() === 0) {
        return false;
    }
    await pageTwo.click();
    await expect(pageTwo).toHaveAttribute("aria-current", "page");
    return true;
}

async function publishPackageData(page: Page, rowLimit?: number): Promise<boolean> {
    return page.evaluate((limit) => {
        const win = window as unknown as {
            quickboxRuntime?: { packageManagement?: { data?: { rows: unknown[] } } };
            quickboxPackageManagementIsland?: { onMessage: (value: unknown) => boolean };
        };
        const data = win.quickboxRuntime?.packageManagement?.data;
        const bridge = win.quickboxPackageManagementIsland;
        if (!data || !bridge) {
            return false;
        }
        return bridge.onMessage(limit === undefined ? data : { ...data, rows: data.rows.slice(0, limit) });
    }, rowLimit);
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

async function captureServiceStatusRequests(page: Page): Promise<void> {
    await page.evaluate(() => {
        const win = window as unknown as {
            socket: { send: (payload: unknown) => unknown };
            __serviceStatusRequests: ServiceStatusRequestFixture[];
        };
        const socket = win.socket;
        const send = socket.send.bind(socket);
        win.__serviceStatusRequests = [];
        socket.send = (payload: unknown) => {
            const request = payload as { key?: string };
            if (request.key === "SERVICE_STATUS_ALL") {
                win.__serviceStatusRequests.push(payload as ServiceStatusRequestFixture);
                return socket;
            }
            return send(payload);
        };
    });
}

async function readServiceStatusRequest(page: Page, index: number): Promise<ServiceStatusRequestFixture> {
    return page.evaluate((requestIndex) => {
        return (window as unknown as { __serviceStatusRequests: ServiceStatusRequestFixture[] }).__serviceStatusRequests[requestIndex];
    }, index);
}

async function captureServiceControlRequests(page: Page): Promise<void> {
    await page.evaluate(() => {
        const win = window as unknown as {
            socket: { send: (payload: unknown) => unknown };
            __serviceControlRequests: ServiceControlRequestFixture[];
        };
        const socket = win.socket;
        const send = socket.send.bind(socket);
        win.__serviceControlRequests = [];
        socket.send = (payload: unknown) => {
            const request = payload as { key?: string };
            if (request.key === "SERVICE_CONTROL") {
                win.__serviceControlRequests.push(payload as ServiceControlRequestFixture);
                return socket;
            }
            return send(payload);
        };
    });
}

async function readServiceControlRequest(page: Page, index: number): Promise<ServiceControlRequestFixture> {
    return page.evaluate((requestIndex) => {
        return (window as unknown as { __serviceControlRequests: ServiceControlRequestFixture[] }).__serviceControlRequests[requestIndex];
    }, index);
}

async function captureNetworkRequests(page: Page): Promise<void> {
    await page.evaluate(() => {
        const win = window as unknown as {
            socket: { send: (payload: unknown) => unknown };
            __networkRequests: NetworkRequestFixture[];
        };
        const socket = win.socket;
        const send = socket.send.bind(socket);
        win.__networkRequests = [];
        socket.send = (payload: unknown) => {
            const request = payload as { key?: string };
            if (request.key === "NETWORK") {
                win.__networkRequests.push(payload as NetworkRequestFixture);
                return socket;
            }
            return send(payload);
        };
    });
}

function makeServiceStatusResponse(
    request: ServiceStatusRequestFixture,
    status: "error" | "success",
): Record<string, unknown> {
    const meta = {
        protocolVersion: request.protocolVersion,
        key: request.key,
        url: request.url,
        requestId: request.requestId,
        locale: request.locale,
        generation: request.generation,
    };
    if (status === "error") {
        return { meta, status, error: { code: "FIXTURE_FAILURE", message: "fixture failure" } };
    }
    return {
        meta,
        status,
        data: {
            states: { rtorrent: { value: false, observedAt: Date.now(), stale: false } },
            health: "ok",
            retryAfterMs: 0,
        },
    };
}

async function openDashboard(page: Page): Promise<void> {
    await page.goto(WS_BASE_URL);
    await expect.poll(async () => isPackageTableReady(page), { timeout: 60000 }).toBe(true);
}

/** The server-rendered badge is unconfirmed; the first successful reply writes
 * data-observed-at and gives stale marking a "last confirmed" time to keep. */
async function waitForConfirmedServiceStatus(page: Page): Promise<void> {
    await expect.poll(
        () => page.locator("#appstat_rtorrent span[data-observed-at]").count(),
        { timeout: 15000 },
    ).toBeGreaterThan(0);
}

test.describe("service status recovery", () => {
    test.setTimeout(45000);

    test("backs off across periodic polls and lets reconnect trigger an immediate request", async ({ page }) => {
        await openDashboard(page);
        await waitForConfirmedServiceStatus(page);
        await captureServiceStatusRequests(page);

        await expect.poll(() => page.evaluate(() => (window as unknown as { __serviceStatusRequests: unknown[] }).__serviceStatusRequests.length), { timeout: 12000 }).toBe(1);
        const firstRequest = await readServiceStatusRequest(page, 0);
        const firstFailureAt = Date.now();
        await deliverSocketMessage(page, makeServiceStatusResponse(firstRequest, "error"));
        // A failed V2 status request cools down for five seconds before retry.
        await expect.poll(() => page.evaluate(() => (window as unknown as { __serviceStatusRequests: unknown[] }).__serviceStatusRequests.length), { timeout: 12000 }).toBe(2);
        expect(Date.now() - firstFailureAt).toBeGreaterThanOrEqual(4500);

        const retryRequest = await readServiceStatusRequest(page, 1);
        await deliverSocketMessage(page, makeServiceStatusResponse(retryRequest, "error"));
        await expect(page.locator("#appstat_rtorrent .badge-service-stale").first()).toBeVisible();
        await page.evaluate(() => {
            const socket = (window as unknown as { socket: { listeners: (event: string) => unknown[] } }).socket;
            for (const listener of socket.listeners("connect")) {
                if (typeof listener === "function") (listener as () => void)();
            }
        });
        const reconnectAt = Date.now();
        await expect.poll(() => page.evaluate(() => (window as unknown as { __serviceStatusRequests: unknown[] }).__serviceStatusRequests.length), { timeout: 4500 }).toBe(3);
        expect(Date.now() - reconnectAt).toBeLessThan(4500);
        await deliverSocketMessage(page, makeServiceStatusResponse(await readServiceStatusRequest(page, 2), "success"));
        await expect(page.locator("#appstat_rtorrent .badge-service-stale")).toHaveCount(0);
    });

    test("marks badges stale on transport failure, rejects late replies and accepts recovery", async ({ page }) => {
        await openDashboard(page);
        await waitForConfirmedServiceStatus(page);
        await captureServiceStatusRequests(page);
        await expect.poll(() => page.evaluate(() => (window as unknown as { __serviceStatusRequests: unknown[] }).__serviceStatusRequests.length), { timeout: 12000 }).toBe(1);
        const failedRequest = await readServiceStatusRequest(page, 0);
        await deliverSocketMessage(page, makeServiceStatusResponse(failedRequest, "error"));
        await expect(page.locator("#appstat_rtorrent .badge-service-stale").first()).toBeVisible();
        await expect(page.locator("#appstat_rtorrent span[title]")).toHaveAttribute("title", /last confirmed/i);

        await deliverSocketMessage(page, makeServiceStatusResponse(failedRequest, "success"));
        await expect(page.locator("#appstat_rtorrent .badge-service-stale").first()).toBeVisible();

        await expect.poll(() => page.evaluate(() => (window as unknown as { __serviceStatusRequests: unknown[] }).__serviceStatusRequests.length), { timeout: 12000 }).toBe(2);
        await deliverSocketMessage(page, makeServiceStatusResponse(await readServiceStatusRequest(page, 1), "success"));
        await expect(page.locator("#appstat_rtorrent .badge-service-disabled-dot")).toBeVisible();
        await expect(page.locator("#appstat_rtorrent .badge-service-stale")).toHaveCount(0);
    });

    test("keeps retrying aggregate status after repeated errors", async ({ page }) => {
        await page.clock.install({ time: new Date("2026-03-24T14:30:00Z") });
        await openDashboard(page);
        await captureServiceStatusRequests(page);
        await page.evaluate(() => (window as any).quickboxServiceIsland.onConnected(0));
        await expect.poll(() => page.evaluate(() => (window as any).__serviceStatusRequests.length)).toBe(1);

        for (let index = 0; index < 33; index += 1) {
            const request = await readServiceStatusRequest(page, index);
            await deliverSocketMessage(page, makeServiceStatusResponse(request, "error"));
            await page.clock.fastForward(31_000);
            await expect.poll(() => page.evaluate(() => (window as any).__serviceStatusRequests.length)).toBe(index + 2);
        }
    });

    test("keeps five second polling when only one collector is degraded", async ({ page }) => {
        await page.clock.install({ time: new Date("2026-03-24T14:30:00Z") });
        await openDashboard(page);
        await waitForConfirmedServiceStatus(page);
        await captureServiceStatusRequests(page);
        await page.evaluate(() => (window as any).quickboxServiceIsland.onConnected(0));
        await expect.poll(() => page.evaluate(() => (window as any).__serviceStatusRequests.length)).toBe(1);
        const request = await readServiceStatusRequest(page, 0);
        await deliverSocketMessage(page, {
            meta: {
                protocolVersion: request.protocolVersion,
                key: request.key,
                url: request.url,
                requestId: request.requestId,
                locale: request.locale,
                generation: request.generation,
            },
            status: "success",
            data: {
                states: { rtorrent: { value: false, observedAt: Date.now(), stale: false } },
                health: "degraded",
                retryAfterMs: 120_000,
            },
        });

        const requestsAfterDegradedReply = await page.evaluate(() => (window as any).__serviceStatusRequests.length);
        await page.clock.fastForward(5_001);
        await expect.poll(() => page.evaluate(() => (window as any).__serviceStatusRequests.length)).toBeGreaterThan(requestsAfterDegradedReply);
    });

    test("reconnect restarts dashboard widget polls stopped by repeated errors", async ({ page }) => {
        await page.clock.install({ time: new Date("2026-03-24T14:30:00Z") });
        await openDashboard(page);
        await expect.poll(() => page.evaluate(() => Boolean((window as unknown as { socket?: { connected?: boolean } }).socket?.connected))).toBe(true);
        await captureNetworkRequests(page);
        await page.evaluate(() => {
            const socket = (window as unknown as { socket: { listeners: (event: string) => unknown[] } }).socket;
            for (const listener of socket.listeners("connect")) {
                if (typeof listener === "function") (listener as () => void)();
            }
        });
        await expect.poll(() => page.evaluate(() => (window as unknown as { __networkRequests: NetworkRequestFixture[] }).__networkRequests.length)).toBe(1);

        for (let index = 0; index < 32; index += 1) {
            const request = await page.evaluate((requestIndex) => (window as unknown as { __networkRequests: NetworkRequestFixture[] }).__networkRequests[requestIndex], index);
            await deliverSocketMessage(page, { key: request.key, url: request.url, requestId: request.requestId, success: false });
            await page.clock.fastForward(1_000);
            await expect.poll(() => page.evaluate(() => (window as unknown as { __networkRequests: NetworkRequestFixture[] }).__networkRequests.length)).toBe(index + 2);
        }

        const stoppedRequest = await page.evaluate(() => (window as unknown as { __networkRequests: NetworkRequestFixture[] }).__networkRequests[32]);
        await deliverSocketMessage(page, { key: stoppedRequest.key, url: stoppedRequest.url, requestId: stoppedRequest.requestId, success: false });
        await page.evaluate(() => {
            const socket = (window as unknown as { socket: { listeners: (event: string) => unknown[] } }).socket;
            for (const listener of socket.listeners("connect")) {
                if (typeof listener === "function") (listener as () => void)();
            }
        });
        await expect.poll(() => page.evaluate(() => (window as unknown as { __networkRequests: NetworkRequestFixture[] }).__networkRequests.length)).toBe(34);
    });
});

test.describe("service action confirmation", () => {
    test.setTimeout(45000);

    test("keeps the confirmed switch value until the action result arrives", async ({ page }) => {
        await openDashboard(page);
        await captureServiceControlRequests(page);
        await page.evaluate(() => (window as any).quickboxServiceIsland.onConnected(0));
        await expect.poll(() => page.evaluate(() => (window as any).__serviceControlRequests.length)).toBeGreaterThan(0);
        const request = await readServiceControlRequest(page, 0);

        await page.evaluate(() => {
            const state = { actions: [] as Array<Record<string, unknown>> };
            (window as any).__serviceActionRequests = state.actions;
            const socket = (window as any).socket;
            const emit = socket.emit.bind(socket);
            socket.emit = (event: string, payload: unknown) => {
                if (event === "service-action") {
                    state.actions.push(payload as Record<string, unknown>);
                    return socket;
                }
                return emit(event, payload);
            };
        });

        const toggle = page.locator("#appstat_rtorrent").locator("xpath=ancestor::tr").locator(".ant-switch");
        await expect(toggle).toHaveAttribute("aria-checked", "true");
        await toggle.click();
        await expect(toggle).toBeDisabled();
        await expect(toggle).toHaveClass(/ant-switch-loading/);
        const spinnerOffset = await toggle.evaluate((el) => {
            const handle = el.querySelector(".ant-switch-handle")?.getBoundingClientRect();
            const icon = el.querySelector(".ant-switch-loading-icon")?.getBoundingClientRect();
            if (!handle || !icon) {return null;}
            return {
                dx: Math.abs((handle.left + handle.width / 2) - (icon.left + icon.width / 2)),
                dy: Math.abs((handle.top + handle.height / 2) - (icon.top + icon.height / 2)),
            };
        });
        expect(spinnerOffset).not.toBeNull();
        expect(spinnerOffset!.dx).toBeLessThan(1.5);
        expect(spinnerOffset!.dy).toBeLessThan(1.5);
        await expect.poll(() => page.evaluate(() => (window as any).__serviceActionRequests.length)).toBe(1);
        const action = await page.evaluate(() => (window as any).__serviceActionRequests[0] as Record<string, unknown>);

        const changedControlRows = await page.evaluate(() => {
            const rows = (window as any).quickboxRuntime.serviceRows.map((row: { id: string; enabledAtBoot: boolean }) =>
                row.id === "rtorrent" ? { ...row, enabledAtBoot: false } : row,
            );
            return rows;
        });
        await deliverSocketMessage(page, {
            meta: {
                protocolVersion: request.protocolVersion,
                key: request.key,
                url: request.url,
                requestId: request.requestId,
                locale: request.locale,
                generation: request.generation,
            },
            status: "success",
            data: { rows: changedControlRows },
        });
        await expect(toggle).toHaveAttribute("aria-checked", "true");

        await page.evaluate((payload) => {
            const bridge = (window as any).quickboxServiceIsland;
            const base = { ...payload, success: true, message: "Service action completed", stdout: "", stderr: "" };
            bridge.onActionResult({ ...base, phase: "action-complete" });
            bridge.onActionResult({
                ...base,
                phase: "status-confirmed",
                enabled: false,
                statusData: {
                    states: { rtorrent: { value: false, observedAt: Date.now(), stale: false } },
                    health: "ok",
                    retryAfterMs: 0,
                },
            });
        }, action);
        await expect(toggle).toHaveAttribute("aria-checked", "false");
        await expect(toggle).toBeEnabled();
    });
});

test.describe("PMC widget state", () => {
    test.setTimeout(120000);

    test("keeps search, sort and page size across a package data refresh", async ({ page }) => {
        await openDashboard(page);

        await setPackageTableState(page, "deluge", [0, "desc"]);
        await expect.poll(async () => (await readPackageTableState(page))?.search).toBe("deluge");

        const before = await readPackageTableState(page);
        expect(before).not.toBeNull();
        if (before === null) {
            return;
        }
        expect(before.sort).toBe("descending");
        expect(before.rowCount).toBe(1);

        // The dashboard's correlated PMC response is applied through this bridge.
        expect(await publishPackageData(page)).toBe(true);

        const after = await readPackageTableState(page);
        expect(after).not.toBeNull();
        if (after === null) {
            return;
        }
        expect(after.search).toBe("deluge");
        expect(after.sort).toBe("descending");
        expect(after.length).toBe(before.length);
        expect(after.rowCount).toBe(1);

        // The filter must be re-applied to the fresh markup.
        expect(after.visibleRows.length).toBeGreaterThan(0);
        for (const row of after.visibleRows) {
            expect(row.toLowerCase()).toContain("deluge");
        }

        // The React island remains mounted while fresh package data is applied.
        await expect(page.locator("#pmc_widget .qb-package-management__table")).toHaveCount(1);
        await expect(page.locator(".dataTables_wrapper")).toHaveCount(1);
    });

    test("keeps the current page when refreshed package data is unchanged", async ({ page }) => {
        await openDashboard(page);

        if (!(await goToSecondPage(page))) {
            test.skip(true, "the package list only has a single page");
        }
        expect((await readPackageTableState(page))?.page).toBe(1);

        expect(await publishPackageData(page)).toBe(true);
        expect(await publishPackageData(page)).toBe(true);

        expect((await readPackageTableState(page))?.page).toBe(1);
        await expect(page.locator(".dataTables_wrapper")).toHaveCount(1);
    });

    test("clamps the current page when refreshed package data has fewer rows", async ({ page }) => {
        await openDashboard(page);

        if (!(await goToSecondPage(page))) {
            test.skip(true, "the package list only has a single page");
        }
        expect((await readPackageTableState(page))?.page).toBe(1);

        expect(await publishPackageData(page, 8)).toBe(true);
        await expect.poll(async () => (await readPackageTableState(page))?.page).toBe(0);
        expect((await readPackageTableState(page))?.search).toBe("");
        await expect(page.locator(".dataTables_wrapper")).toHaveCount(1);
    });
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
                if (!new URL(url, location.href).pathname.endsWith("/node/data/system_load")) {
                    return response;
                }

                const readJson = response.json.bind(response);
                response.json = async () => {
                    const body = await readJson();
                    control.bodyReady = true;
                    await bodyGate;

                    // This task runs after the released JSON promise and the
                    // dashboard's prefetch microtasks complete.
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

        await page.route("**/node/data/system_load*", async (route) => {
            await prefetchGate;
            await route.fulfill({
                status: 200,
                contentType: "application/json",
                body: JSON.stringify({ text: "STALE-PREFETCH" }),
            });
        });

        await page.goto(WS_BASE_URL);
        await expect.poll(async () => page.evaluate(() => {
            return Boolean((window as unknown as { socket?: SocketLike }).socket?.connected);
        })).toBe(true);

        await expect(page.locator("#cpuload")).toHaveAttribute("data-qb-write-source", "ws");
        const wsText = await page.locator("#cpuload").innerText();
        expect(wsText).not.toContain("STALE-PREFETCH");

        releasePrefetch();
        await expect.poll(() => page.evaluate(() => {
            return (window as unknown as { prefetchControl: PrefetchControl }).prefetchControl.bodyReady;
        })).toBe(true);
        expect(await page.locator("#cpuload").innerText()).toBe(wsText);

        await page.evaluate(async () => {
            const control = (window as unknown as { prefetchControl: PrefetchControl }).prefetchControl;
            control.releaseBody();
            await control.consumed;
        });

        expect(await page.locator("#cpuload").innerText()).toBe(wsText);
    });
});

interface SocketLike {
    connected: boolean;
    listeners: (event: string) => unknown[];
    on: (event: string, listener: (payload: unknown) => void) => void;
    off: (event: string, listener: (payload: unknown) => void) => void;
    emit: (event: string, payload?: unknown) => void;
}
