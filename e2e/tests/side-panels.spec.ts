// SPDX-License-Identifier: GPL-3.0-or-later
//
// The right column is only a quarter of the content area, so its cards are
// narrow even on a desktop viewport; the panels must wrap instead of
// clipping the mount point and disk metrics.

import { test, expect, type Page } from "@playwright/test";
import path from "node:path";

import { resetMockProfile, setMockProfile } from "./support/helpers";

test.beforeEach(async ({ page }) => {
    await resetMockProfile(page);
});

function pauseRequest() {
    let release: () => void = () => {};
    const gate = new Promise<void>(resolve => { release = resolve; });
    return { gate, release };
}

for (const { width, locale } of [{ width: 1280, locale: "zh" }, { width: 320, locale: "fr" }]) {
    test(`server load keeps its height while data loads at ${width}px (${locale})`, async ({ page }) => {
        const bootstrap = pauseRequest();
        const load = pauseRequest();
        const socket = pauseRequest();
        await page.setViewportSize({ width, height: 900 });
        await page.route("https://fonts.googleapis.com/**", route => route.abort());
        await page.route("**/node/bootstrap*", async route => {
            await bootstrap.gate;
            await route.continue();
        });
        await page.route("**/node/data/system_load*", async route => {
            await load.gate;
            await route.continue();
        });
        await page.route("**/socket.io/**", async route => {
            await socket.gate;
            await route.continue();
        });

        const loadPlaceholder = page.locator("#cpuload .qb-skeleton");
        const uptimePlaceholder = page.locator("#uptime .qb-skeleton");
        const measure = () => page.evaluate(() => {
            const loadCard = document.querySelector("[data-inner-id='panel-server-load']")!.getBoundingClientRect();
            const cpuCard = document.querySelector("[data-inner-id='panel-server-cpu']")!.getBoundingClientRect();
            return {
                loadLine: document.querySelector("#cpuload")!.parentElement!.getBoundingClientRect().height,
                uptimeLine: document.querySelector(".qb-uptime")!.getBoundingClientRect().height,
                cpuOffset: cpuCard.top - loadCard.top,
            };
        });

        try {
            await page.goto(`/?locale=${locale}`);
            await expect(loadPlaceholder).toBeVisible();
            await expect(uptimePlaceholder).toBeVisible();
            const loading = await measure();
            const expectStableLayout = async () => {
                const current = await measure();
                expect(Math.abs(current.loadLine - loading.loadLine), "load line height").toBeLessThanOrEqual(1);
                expect(Math.abs(current.uptimeLine - loading.uptimeLine), "uptime height").toBeLessThanOrEqual(1);
                expect(Math.abs(current.cpuOffset - loading.cpuOffset), "CPU card offset").toBeLessThanOrEqual(1);
            };

            bootstrap.release();
            await expect(uptimePlaceholder).toHaveCount(0);
            await expect(loadPlaceholder).toBeVisible();
            await expectStableLayout();

            load.release();
            await expect(loadPlaceholder).toHaveCount(0);
            await expectStableLayout();
        } finally {
            bootstrap.release();
            load.release();
            socket.release();
        }
    });
}

test("loading cards reserve space for their content at a narrow viewport", async ({ page }) => {
    const bootstrap = pauseRequest();
    const systemData = pauseRequest();
    await page.setViewportSize({ width: 390, height: 900 });
    await page.route("https://fonts.googleapis.com/**", route => route.abort());
    await page.route("**/node/bootstrap*", async route => {
        await bootstrap.gate;
        await route.continue();
    });
    await page.route(/\/node\/data\/(system_static|disk_data|ram_stats)\?/, async route => {
        await systemData.gate;
        await route.continue();
    });
    await page.route("**/socket.io/**", async route => {
        await systemData.gate;
        await route.continue();
    });

    const packages = page.locator("[data-inner-id='panel-server-package-management']");
    const services = page.locator("[data-inner-id='panel-server-service-control']");
    const cpu = page.locator("[data-inner-id='panel-server-cpu']");
    const disk = page.locator("[data-inner-id='panel-server-disk']");
    const height = (panel: typeof packages) => panel.evaluate(element => element.getBoundingClientRect().height);

    try {
        await page.goto("/?locale=fr");
        await expect(packages).toHaveAttribute("aria-busy", "true");
        await expect(services).toHaveAttribute("aria-busy", "true");
        await expect(packages.locator("#dataTable1-search")).toBeDisabled();
        const memoryLines = page.locator("#meterram p").first().locator(".qb-skeleton");
        await expect(memoryLines).toHaveCount(2);
        const firstLine = (await memoryLines.first().boundingBox())!;
        const secondLine = (await memoryLines.last().boundingBox())!;
        expect(secondLine.y).toBeGreaterThan(firstLine.y + firstLine.height);
        const packageLoadingHeight = await height(packages);
        const serviceLoadingHeader = await height(services.locator("thead"));

        bootstrap.release();
        await expect(packages).toHaveAttribute("aria-busy", "false");
        await expect(services).toHaveAttribute("aria-busy", "false");
        await expect(packages.locator("tbody tr.ant-table-row")).toHaveCount(10);
        expect(Math.abs(await height(packages) - packageLoadingHeight)).toBeLessThanOrEqual(25);
        expect(await height(services.locator("thead"))).toBe(serviceLoadingHeader);

        await expect(cpu.locator(".qb-skeleton")).toHaveCount(3);
        const cpuLoadingHeight = await height(cpu);
        const diskLoadingHeight = await height(disk);

        systemData.release();
        await expect(cpu.locator(".qb-skeleton")).toHaveCount(0);
        await expect(disk.locator("#disk_data > [aria-busy='false']")).toBeVisible();
        expect(Math.abs(await height(cpu) - cpuLoadingHeight)).toBeLessThanOrEqual(20);
        expect(Math.abs(await height(disk) - diskLoadingHeight)).toBeLessThan(200);
    } finally {
        bootstrap.release();
        systemData.release();
    }
});

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
                await setMockProfile(page, "partial-running");
                await page.goto("/?locale=zh");
                await expect(page.locator("#disk_data [aria-busy='false'] .qb-disk-metric").first()).toBeVisible();

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
                await resetMockProfile(page);
            }
        });
    }
}
