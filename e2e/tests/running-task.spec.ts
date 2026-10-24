// SPDX-License-Identifier: GPL-3.0-or-later

import { test, expect, type Page } from "@playwright/test";

import { resetMockProfile, setMockProfile } from "./support/helpers";

async function openInstalling(page: Page) {
    await setMockProfile(page, "installing");
    await page.goto("/?locale=zh");
    await expect(page.locator("#running_task_widget .qb-running-task")).toBeVisible();
}

test.beforeEach(async ({ page }) => {
    await resetMockProfile(page);
});

test("names the running operation and opens its log", async ({ page }) => {
    await openInstalling(page);
    const banner = page.locator("#running_task_widget .qb-running-task");
    // The verb matters: the lock alone only carries the display title.
    await expect(banner).toContainText("正在安装: Jellyfin Media Server");
    await expect(banner).toHaveAttribute("data-task", "install");
    await expect(banner).toHaveAttribute("data-operation", "install");

    await banner.locator("[data-target='#sysResponse']").click();
    await expect(page.locator("#sysResponse")).toBeVisible();
    // The banner opens the same dialog as every other entry: refresh is the
    // footer action, the header X only dismisses.
    await expect(page.locator("#sysResponseCloseAction")).toHaveText("关闭 & 刷新");
    await page.locator("#sysResponseDismiss").click();
    await expect(page.locator("#sysResponse")).toBeHidden();
});

test("terminates the running operation and clears the banner", async ({ page }) => {
    await openInstalling(page);
    await page.locator("#running_task_widget [data-target='#taskAbortConfirm']").click();
    await expect(page.locator("#taskAbortConfirm")).toBeVisible();

    const [execResponse] = await Promise.all([
        page.evaluate(() => new Promise<{ success: boolean }>((resolve) => {
            const socket = (window as unknown as {
                socket?: { once: (event: string, callback: (data: { success: boolean }) => void) => void };
            }).socket;
            if (!socket) {
                throw new Error("the dashboard socket is not available");
            }
            socket.once("exec", resolve);
        })),
        page.locator("#taskAbortConfirmGo").click(),
    ]);
    expect(execResponse).toMatchObject({ success: true });

    // The banner is polled, so it disappears on the next refresh without a reload.
    await expect(page.locator("#running_task_widget .qb-running-task")).toHaveCount(0, { timeout: 15_000 });
    await expect(page.locator("#taskAbortConfirm")).toBeHidden();
});

test("stays hidden while no operation holds the lock", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#pmc_widget table")).toBeVisible({ timeout: 30_000 });
    await expect(page.locator("#running_task_widget .qb-running-task")).toHaveCount(0);
});
