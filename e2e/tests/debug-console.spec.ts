import { test, expect } from "@playwright/test";
import { createHash } from "node:crypto";

import {
    WS_BASE_URL,
    getRenderedWidgetText,
    resetMockProfile,
    setMockProfile,
    snap,
} from "./support/helpers";

test.beforeEach(async ({ page }) => {
    await resetMockProfile(page);
});

test.describe("WS Debug Console", () => {
    test("should load the debug page", async ({ page }, testInfo) => {
        await page.goto(`${WS_BASE_URL}/debug`);
        await expect(page.locator("h1")).toContainText("QuickBox WS Debug Console");
        await snap(page, testInfo, "debug-console");
    });

    test("should list widget endpoints", async ({ page }) => {
        await page.goto(`${WS_BASE_URL}/debug`);
        await expect(page.locator("[data-url='/node/data/system_load']")).toBeVisible();
        await expect(page.locator("[data-url='/node/data/system_uptime']")).toBeVisible();
        await expect(page.locator("[data-url='/node/data/ram_stats']")).toBeVisible();
        await expect(page.locator("[data-url='/node/data/disk_data']")).toBeVisible();
    });

    test("canonicalizes both debug paths with a trailing slash", async ({ page }) => {
        for (const pathname of ["/debug", "/ws/debug"]) {
            await page.goto(`${pathname}/?locale=en&source=test`);
            await expect(page).toHaveURL(new RegExp(`${pathname}\\?locale=en&source=test$`));
            await expect(page.locator("h1")).toContainText("QuickBox WS Debug Console");
        }
    });

    test("ignores a slow result from a previously selected endpoint", async ({ page }) => {
        let release: () => void = () => {};
        const gate = new Promise<void>(resolve => { release = resolve; });
        await page.route(url => url.pathname.endsWith("/debug/node") &&
            url.searchParams.get("url") === "/node/data/system_uptime", async (route) => {
            await gate;
            await route.fulfill({ json: { days: 99, hours: 0, minutes: 0 } }).catch(() => {});
        });
        try {
            await page.goto(`${WS_BASE_URL}/debug`);
            const uptimeRequest = page.waitForRequest(request =>
                new URL(request.url()).searchParams.get("url") === "/node/data/system_uptime");
            await page.locator("[data-url='/node/data/system_uptime']").click();
            await uptimeRequest;
            const cancelled = page.waitForEvent("requestfailed", {
                predicate: request => new URL(request.url()).searchParams.get("url") === "/node/data/system_uptime",
            });
            await page.locator("[data-url='/node/data/ram_stats']").click();
            await cancelled;
            await expect(page.locator("#result-title")).toContainText("RAM");
            await expect.poll(() => getRenderedWidgetText(page)).not.toBe("");
            const ram = await getRenderedWidgetText(page);
            release();
            await expect(page.locator("#result-title")).toContainText("RAM");
            expect(await getRenderedWidgetText(page)).toBe(ram);
        } finally {
            release();
        }
    });

    test("should fetch uptime widget via debug console", async ({ page }, testInfo) => {
        await page.goto(`${WS_BASE_URL}/debug`);
        await page.locator("[data-url='/node/data/system_uptime']").click();
        const resultTitle = page.locator("#result-title");
        await expect(resultTitle).toContainText("Uptime", { timeout: 10_000 });
        await expect.poll(() => getRenderedWidgetText(page), { timeout: 10_000 }).not.toEqual("");
        await snap(page, testInfo, "debug-uptime-result");
    });

    test("should fetch load widget via debug console", async ({ page }) => {
        // The expected value is owned by the all-running profile, so it has to be
        // selected here instead of relying on whatever ran before.
        await setMockProfile(page, "all-running");
        await page.goto(`${WS_BASE_URL}/debug`);
        await page.locator("[data-url='/node/data/system_load']").click();
        await expect.poll(() => getRenderedWidgetText(page), { timeout: 10_000 }).not.toEqual("");
        // The profile fluctuates around "1.52 1.34 1.21", so only the shape of
        // the three two-decimal averages is stable.
        await expect.poll(() => getRenderedWidgetText(page), { timeout: 10_000 })
            .toMatch(/\d+\.\d{2}\s+\d+\.\d{2}\s+\d+\.\d{2}/);
    });

    test("should fetch RAM stats widget via debug console", async ({ page }) => {
        await page.goto(`${WS_BASE_URL}/debug`);
        await page.locator("[data-url='/node/data/ram_stats']").click();
        await expect.poll(() => getRenderedWidgetText(page), { timeout: 10_000 }).not.toEqual("");
    });

    test("should fetch disk data widget via debug console", async ({ page }, testInfo) => {
        await page.goto(`${WS_BASE_URL}/debug`);
        await page.locator("[data-url='/node/data/disk_data']").click();
        await expect.poll(() => getRenderedWidgetText(page), { timeout: 10_000 }).not.toEqual("");
        await snap(page, testInfo, "debug-disk-data-result");
    });

    test("should handle /debug/node API directly", async ({ page }) => {
        await setMockProfile(page, "all-running");
        const response = await page.request.get(`${WS_BASE_URL}/debug/node?url=/node/data/system_uptime`);
        expect(response.ok()).toBeTruthy();
        const body = await response.json() as { days: number };
        // all-running reports 15 days of uptime.
        expect(body.days).toBe(15);
    });

    test("should return error for unknown widget", async ({ page }) => {
        const response = await page.request.get(`${WS_BASE_URL}/debug/node?url=/node/nonexistent`);
        expect(response.status()).toBe(500);
    });
});

test.describe("WS API Endpoints", () => {
    test("should serve versioned dashboard stylesheets and debug metadata", async ({ page }) => {
        await page.goto("/");
        const theme = await page.locator("body").getAttribute("data-theme");
        expect(theme).toMatch(/^(defaulted|smoked)$/);
        const stylesheets = await page.locator('link[rel="stylesheet"]').evaluateAll((links) =>
            links.map((link) => new URL((link as HTMLLinkElement).href))
                .filter((url) => url.origin === location.origin)
                .map((url) => url.href),
        );
        expect(stylesheets).toEqual(expect.arrayContaining([
            expect.stringContaining("/css/dashboard-theme.css"),
            expect.stringContaining("/css/package-management.css"),
        ]));
        for (const href of stylesheets) {
            const response = await page.request.get(href);
            expect(response.ok(), href).toBeTruthy();
            const body = await response.body();
            const url = new URL(href);
            expect(url.searchParams.get("v"), href).toBe(createHash("sha256").update(body).digest("hex").slice(0, 12));
            if (url.pathname.endsWith("/css/dashboard-theme.css")) {
                expect(body.toString()).toContain("Reconstructed QuickBox application rules");
            }
        }
        const debugMeta = await page.request.get(`${WS_BASE_URL.replace(/\/+$/, "")}/debug/meta`);

        expect(debugMeta.status()).toBe(200);
        const meta = (await debugMeta.json()) as { endpoints: unknown[] };
        expect(meta.endpoints.length).toBeGreaterThan(0);
    });

    test("should return the Node dashboard at the root endpoint", async ({ page }) => {
        const response = await page.request.get(`${WS_BASE_URL}/`);
        expect(response.ok()).toBeTruthy();
        const text = await response.text();
        expect(text).toContain("<title>Quickbox Dashboard</title>");
    });

    test("should support profile switching in test mode", async ({ page }) => {
        // Switch to empty-system profile
        let response = await page.request.post(`${WS_BASE_URL}/test/profile`, {
            data: { profile: "empty-system" },
        });
        expect(response.ok()).toBeTruthy();

        // Load data reflects an empty system: no processes, and a load average
        // that drifts around the fixture's 0.05 instead of sitting on it.
        const loadResponse = await page.request.get(`${WS_BASE_URL}/debug/node?url=/node/data/system_load`);
        const load = await loadResponse.json() as { loadavg: number[]; processes: number };
        expect(load.processes).toBe(0);
        expect(load.loadavg[0]).toBeLessThan(0.1);

        // Switch back
        response = await page.request.post(`${WS_BASE_URL}/test/profile`, {
            data: { profile: "all-running" },
        });
        expect(response.ok()).toBeTruthy();
    });
});
