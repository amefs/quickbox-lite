// SPDX-License-Identifier: GPL-3.0-or-later

import { test, expect, type Page } from "@playwright/test";

const wsBase = process.env.WS_BASE_URL || `http://127.0.0.1:${process.env.TEST_WS_PORT || "8575"}`;

async function openInstalling(page: Page) {
    const response = await page.request.post(`${wsBase}/test/profile`, { data: { profile: "installing" } });
    expect(response.ok()).toBeTruthy();
    await page.goto("/?locale=zh");
    await expect(page.locator("#running_task_widget .qb-running-task")).toBeVisible();
}

test.afterEach(async ({ page }) => {
    await page.request.post(`${wsBase}/test/profile`, { data: { profile: "partial-running" } });
});

test("names the running operation and opens its log", async ({ page }) => {
    await openInstalling(page);
    const banner = page.locator("#running_task_widget .qb-running-task");
    await expect(banner).toContainText("Jellyfin Media Server");
    await expect(banner).toHaveAttribute("data-task", "package");

    await banner.locator("[data-sysresponse-mode='log-view']").click();
    await expect(page.locator("#sysResponse")).toBeVisible();
    await page.locator("#sysResponseCloseAction").click();
    await expect(page.locator("#sysResponse")).toBeHidden();
});

test("terminates the running operation and clears the banner", async ({ page }) => {
    await openInstalling(page);
    await page.locator("#running_task_widget [data-target='#taskAbortConfirm']").click();
    await expect(page.locator("#taskAbortConfirm")).toBeVisible();

    const execResponse = page.evaluate(() => new Promise<{ success: boolean }>((resolve) => {
        (window as Window & { socket: { once: (event: string, callback: (data: { success: boolean }) => void) => void } }).socket.once("exec", resolve);
    }));
    await page.locator("#taskAbortConfirmGo").click();
    expect(await execResponse).toMatchObject({ success: true });

    // The banner is polled, so it disappears on the next refresh without a reload.
    await expect(page.locator("#running_task_widget .qb-running-task")).toHaveCount(0, { timeout: 15_000 });
    await expect(page.locator("#taskAbortConfirm")).toBeHidden();
});

test("stays hidden while no operation holds the lock", async ({ page }) => {
    await page.request.post(`${wsBase}/test/profile`, { data: { profile: "partial-running" } });
    await page.goto("/");
    await expect(page.locator("#pmc_widget table")).toBeVisible({ timeout: 30_000 });
    await expect(page.locator("#running_task_widget .qb-running-task")).toHaveCount(0);
});
