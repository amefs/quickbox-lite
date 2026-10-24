// SPDX-License-Identifier: GPL-3.0-or-later

import { test, expect, type Page } from "@playwright/test";
import path from "node:path";

const wsBase = process.env.WS_BASE_URL || `http://127.0.0.1:${process.env.TEST_WS_PORT || "8575"}`;

async function readLayout(page: Page) {
    return page.evaluate(() => {
        const main = document.querySelector(".mainpanel")!.getBoundingClientRect();
        const header = document.querySelector(".headerbar")!.getBoundingClientRect();
        const sidebar = document.querySelector(".leftpanel")!.getBoundingClientRect();
        return {
            mainX: main.x,
            mainWidth: main.width,
            headerX: header.x,
            headerWidth: header.width,
            sidebarX: sidebar.x,
            sidebarWidth: sidebar.width,
            documentWidth: document.documentElement.scrollWidth,
            viewportWidth: window.innerWidth,
            visualWidth: window.visualViewport!.width,
            scale: window.visualViewport!.scale,
            fontSize: getComputedStyle(document.querySelector(".panel-title")!).fontSize,
        };
    });
}

for (const theme of ["smoked", "defaulted"]) {
    for (const width of [320, 390, 768, 1280, 1440]) {
        test(`${theme}: sidebar moves content without expanding the mobile viewport at ${width}px`, async ({ page }, testInfo) => {
            await page.setViewportSize({ width, height: 844 });
            await page.route("**/skins/quick.css", route => route.fulfill({
                path: path.resolve(__dirname, `../../setup/themes/${theme}/skins/quick.css`),
                contentType: "text/css",
            }));
            try {
                const response = await page.request.post(`${wsBase}/test/profile`, { data: { profile: "long-branch" } });
                expect(response.ok()).toBeTruthy();
                await page.goto("/?locale=zh");
                const initial = await readLayout(page);
                expect(initial.documentWidth).toBe(width);
                const mobile = width < 1280;
                for (let cycle = 0; cycle < 2; cycle++) {
                    await page.locator("#menuToggle").click();
                    await expect.poll(async () => (await readLayout(page)).mainX).toBe(mobile ? 280 : 0);
                    const expanded = await readLayout(page);
                    expect(expanded.documentWidth).toBe(width);
                    expect(expanded.viewportWidth).toBe(initial.viewportWidth);
                    expect(expanded.visualWidth).toBe(initial.visualWidth);
                    expect(expanded.scale).toBe(initial.scale);
                    expect(expanded.fontSize).toBe(initial.fontSize);
                    expect(expanded.sidebarWidth).toBe(280);
                    expect(expanded.sidebarX).toBe(mobile ? 0 : -280);
                    expect(expanded.mainWidth).toBe(mobile ? initial.mainWidth : initial.mainWidth + 280);
                    expect(expanded.headerWidth).toBe(mobile ? initial.headerWidth : initial.headerWidth + 280);
                    expect(expanded.headerX).toBe(expanded.mainX);
                    if (cycle === 0) {
                        await testInfo.attach("sidebar-toggled", {
                            body: await page.screenshot({ path: testInfo.outputPath("sidebar-toggled.png") }),
                            contentType: "image/png",
                        });
                    }
                    await page.locator("#menuToggle").click();
                    await expect.poll(() => readLayout(page)).toEqual(initial);
                }
                if (mobile) {
                    await page.evaluate(() => window.scrollTo(0, 200));
                    expect(await page.evaluate(() => window.scrollY)).toBe(200);
                }
            } finally {
                await page.request.post(`${wsBase}/test/profile`, { data: { profile: "partial-running" } });
            }
        });
    }
}
