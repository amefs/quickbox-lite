// SPDX-License-Identifier: GPL-3.0-or-later
//
// The right column is only a quarter of the content area, so its cards are
// narrow even on a desktop viewport. These panels used to squeeze the text
// column with a fixed-size icon column, which clipped the mount point and
// broke disk metrics in the middle of a value.

import { test, expect, type Page } from "@playwright/test";
import path from "node:path";

const wsBase = process.env.WS_BASE_URL || `http://127.0.0.1:${process.env.TEST_WS_PORT || "8575"}`;

async function readPanels(page: Page) {
    return page.evaluate(() => {
        const rect = (selector: string) => {
            const element = document.querySelector(selector);
            if (!element) {
                throw new Error(`missing element: ${selector}`);
            }
            const box = element.getBoundingClientRect();
            return { left: box.left, right: box.right, top: box.top, bottom: box.bottom, width: box.width };
        };
        const overflowX = (selector: string) => {
            const element = document.querySelector(selector) as HTMLElement | null;
            if (!element) {
                throw new Error(`missing element: ${selector}`);
            }
            return element.scrollWidth - element.clientWidth;
        };
        return {
            documentWidth: document.documentElement.scrollWidth,
            viewportWidth: window.innerWidth,
            diskBody: rect("#disk_data"),
            mountPoint: rect("#disk_data .qb-mount-point"),
            mountPointOverflow: overflowX("#disk_data .qb-mount-point"),
            metrics: Array.from(document.querySelectorAll("#disk_data .qb-disk-metric"))
                .map((element) => element.getBoundingClientRect())
                .map((box) => ({ left: box.left, right: box.right, width: box.width, height: box.height })),
            loadBody: rect("[data-inner-id='panel-server-load'] .panel-body"),
            loadMain: rect("[data-inner-id='panel-server-load'] .qb-panel-main"),
            loadIcon: rect("[data-inner-id='panel-server-load'] .qb-panel-icon"),
            uptime: rect("[data-inner-id='panel-server-load'] .qb-uptime"),
        };
    });
}

for (const theme of ["smoked", "defaulted"]) {
    for (const width of [320, 390, 768, 1024, 1440]) {
        test(`${theme}: side panels keep text readable at ${width}px`, async ({ page }) => {
            await page.setViewportSize({ width, height: 900 });
            await page.route("**/skins/quick.css", route => route.fulfill({
                path: path.resolve(__dirname, `../../setup/themes/${theme}/skins/quick.css`),
                contentType: "text/css",
            }));
            try {
                const response = await page.request.post(`${wsBase}/test/profile`, { data: { profile: "partial-running" } });
                expect(response.ok()).toBeTruthy();
                await page.goto("/?locale=zh");
                await expect(page.locator("#disk_data .qb-disk-metric").first()).toBeVisible();

                const layout = await readPanels(page);

                expect(layout.documentWidth).toBe(layout.viewportWidth);

                // The mount point wraps inside the card instead of being clipped.
                expect(layout.mountPointOverflow).toBeLessThanOrEqual(0);
                expect(layout.mountPoint.left).toBeGreaterThanOrEqual(layout.diskBody.left);
                expect(layout.mountPoint.right).toBeLessThanOrEqual(layout.diskBody.right + 1);

                // Disk metrics stay whole: no value is cut off by the icon column.
                expect(layout.metrics.length).toBeGreaterThan(0);
                for (const metric of layout.metrics) {
                    expect(metric.width).toBeGreaterThan(0);
                    expect(metric.right).toBeLessThanOrEqual(layout.diskBody.right + 1);
                    expect(metric.height).toBeLessThan(60);
                }

                // The load panel keeps the icon beside the text without overlap.
                expect(layout.loadMain.right).toBeLessThanOrEqual(layout.loadIcon.left + 1);
                expect(layout.loadMain.width).toBeGreaterThan(80);
                expect(layout.loadIcon.right).toBeLessThanOrEqual(layout.loadBody.right + 1);
                expect(layout.uptime.left).toBeGreaterThanOrEqual(layout.loadBody.left);
                expect(layout.uptime.right).toBeLessThanOrEqual(layout.loadBody.right + 1);
            } finally {
                await page.request.post(`${wsBase}/test/profile`, { data: { profile: "partial-running" } });
            }
        });
    }
}
