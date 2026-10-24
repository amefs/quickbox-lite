// SPDX-License-Identifier: GPL-3.0-or-later

import { test, expect, type Page } from "@playwright/test";
import path from "node:path";

import { resetMockProfile, setMockProfile } from "./support/helpers";

test.beforeEach(async ({ page }) => {
    await resetMockProfile(page);
});

async function expectHeaderContained(page: Page) {
    const header = await page.locator(".headerpanel").boundingBox();
    expect(header).not.toBeNull();
    for (const selector of ["#menuToggle", ".headermenu > li"]) {
        for (const item of await page.locator(selector).all()) {
            const box = await item.boundingBox();
            expect(box).not.toBeNull();
            expect(box!.x).toBeGreaterThanOrEqual(0);
            expect(box!.x + box!.width).toBeLessThanOrEqual(header!.width + 1);
            expect(box!.y).toBeGreaterThanOrEqual(header!.y);
            expect(box!.y + box!.height).toBeLessThanOrEqual(header!.y + header!.height);
        }
    }
    const content = await page.locator(".contentpanel").boundingBox();
    expect(content!.y).toBeGreaterThanOrEqual(header!.y + header!.height);
}

for (const theme of ["smoked", "defaulted"]) {
    for (const width of [320, 390, 768, 1280, 1440]) {
        test(`${theme}: long branch keeps header controls usable at ${width}px`, async ({ page }, testInfo) => {
            await page.setViewportSize({ width, height: 844 });
            await page.route("**/skins/quick.css", route => route.fulfill({
                path: path.resolve(__dirname, `../../setup/themes/${theme}/skins/quick.css`),
                contentType: "text/css",
            }));
            try {
                await setMockProfile(page, "long-branch");
                for (const locale of ["zh", "en"]) {
                    await page.goto(`/?locale=${locale}`);
                    await expect(page.locator(".headermenu .label-warning")).toContainText("fix/dashboard-review-findings");
                    await expect(page.locator(".headermenu .label-warning")).toHaveAttribute("title", /fix\/dashboard-review-findings-with-an-extremely-long-branch-name\(dd47129\)/);
                    await expectHeaderContained(page);
                    await page.locator("#noticePanel > button").click();
                    await expect(page.locator("#noticeDropdown")).toBeVisible();
                    const dropdown = await page.locator("#noticeDropdown").boundingBox();
                    expect(dropdown!.x).toBeGreaterThanOrEqual(0);
                    expect(dropdown!.x + dropdown!.width).toBeLessThanOrEqual(width + 1);
                    await page.mouse.click(5, 80);
                    await expect(page.locator("#noticeDropdown")).toBeHidden();
                    const account = page.locator(".headermenu > li:last-child button");
                    await account.click();
                    const accountMenu = page.locator(".headermenu > li:last-child .dropdown-menu");
                    await expect(accountMenu).toBeVisible();
                    const accountBox = await accountMenu.boundingBox();
                    expect(accountBox!.x).toBeGreaterThanOrEqual(0);
                    expect(accountBox!.x + accountBox!.width).toBeLessThanOrEqual(width + 1);
                    await page.mouse.click(5, 80);
                    await expect(accountMenu).toBeHidden();
                }
                await testInfo.attach("long-branch-header", {
                    body: await page.locator(".headerpanel").screenshot({ path: testInfo.outputPath("long-branch-header.png") }),
                    contentType: "image/png",
                });
                await setMockProfile(page, "all-running");
                await page.reload();
                await expect(page.locator(".headermenu .label-warning")).toHaveCount(0);
                await expectHeaderContained(page);
            } finally {
                await resetMockProfile(page);
            }
        });
    }
}
