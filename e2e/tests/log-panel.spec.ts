// SPDX-License-Identifier: GPL-3.0-or-later

import { test, expect, type Page } from "@playwright/test";
import path from "node:path";

const wsBase = process.env.WS_BASE_URL || `http://127.0.0.1:${process.env.TEST_WS_PORT || "8575"}`;
const log = Array.from({ length: 160 }, (_, index) => `第 ${index + 1} 行：\u001b[32m任务输出\u001b[0m ${"long-path/".repeat(16)} <script>unsafe()</script>\n`).join("");

async function openLog(page: Page) {
    const response = await page.request.post(`${wsBase}/test/profile`, { data: { profile: "installing" } });
    expect(response.ok()).toBeTruthy();
    await page.goto("/?locale=zh");
    // The running-task banner also offers a log view; this one comes from the
    // install-lock notice in the package panel.
    const trigger = page.locator("#pmc_widget [data-sysresponse-mode='log-view']");
    await expect(trigger).toBeVisible();
    await expect.poll(() => page.evaluate(() => Boolean((window as unknown as { socket?: { connected: boolean } }).socket?.connected))).toBe(true);
    await page.evaluate(() => (window as unknown as { socket: { disconnect(): void } }).socket.disconnect());
    await trigger.click();
    await expect(page.locator("#sysResponse")).toBeVisible();
    await page.locator("#sysResponse").evaluate(async el => {
        await Promise.all(el.getAnimations({ subtree: true }).map(animation => animation.finished));
    });
}

async function deliverLog(page: Page, content: string, start = 0) {
    await page.evaluate(({ content, start }) => {
        const socket = (window as unknown as { socket: { listeners(event: string): ((payload: unknown) => void)[] } }).socket;
        for (const listener of socket.listeners("message")) {
            listener({ key: "SSH_OUTPUT", success: true, response: { content, start, end: start + content.length, epoch: "mobile-log" } });
        }
    }, { content, start });
}

async function expectLogInViewport(page: Page) {
    const viewport = page.viewportSize()!;
    for (const selector of ["#sysResponse .modal-dialog", "#sysResponse .modal-title", "#sysPre", "#sysResponseCloseAction"]) {
        const box = await page.locator(selector).boundingBox();
        expect(box).not.toBeNull();
        expect(box!.x).toBeGreaterThanOrEqual(0);
        expect(box!.y).toBeGreaterThanOrEqual(0);
        expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width);
        expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height);
    }
}

// The close action is the only way out of the dialog, so it keeps a touch-sized
// target. Its label has to grow with the target instead of sitting inside it at
// btn-xs size, which is what made the button look like a stray red block.
async function expectCloseActionProportions(page: Page) {
    const metrics = await page.locator("#sysResponseCloseAction").evaluate(el => {
        const style = getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        return {
            fontSize: parseFloat(style.fontSize),
            paddingY: parseFloat(style.paddingTop),
            height: rect.height,
            width: rect.width,
        };
    });
    expect(metrics.fontSize).toBeGreaterThanOrEqual(14);
    expect(metrics.paddingY).toBeGreaterThanOrEqual(6);
    expect(metrics.width).toBeGreaterThanOrEqual(80);
    expect(metrics.height).toBeGreaterThanOrEqual(36);
    expect(metrics.height).toBeLessThanOrEqual(46);
}

test.afterEach(async ({ page }) => {
    await page.request.post(`${wsBase}/test/profile`, { data: { profile: "partial-running" } });
});

for (const theme of ["smoked", "defaulted"]) {
    for (const viewport of [{ width: 320, height: 568 }, { width: 390, height: 844 }, { width: 844, height: 390 }, { width: 1280, height: 800 }]) {
        test(`${theme}: log panel fits and scrolls at ${viewport.width}x${viewport.height}`, async ({ page }, testInfo) => {
            await page.setViewportSize(viewport);
            await page.route("**/skins/quick.css", route => route.fulfill({
                path: path.resolve(__dirname, `../../setup/themes/${theme}/skins/quick.css`),
                contentType: "text/css",
            }));
            await openLog(page);
            await expectLogInViewport(page);
            await expectCloseActionProportions(page);
            await deliverLog(page, log);
            await expect(page.locator("#sshoutput")).toContainText("第 160 行");
            await expect(page.locator("#sshoutput script")).toHaveCount(0);
            await expect(page.locator("#sshoutput")).toContainText("<script>unsafe()</script>");
            await expectLogInViewport(page);
            const output = page.locator("#sysPre");
            expect(await output.evaluate(el => el.scrollHeight)).toBeGreaterThan(await output.evaluate(el => el.clientHeight));
            expect(await output.evaluate(el => el.scrollWidth)).toBeLessThanOrEqual(await output.evaluate(el => el.clientWidth));
            await expect.poll(() => output.evaluate(el => el.scrollHeight - el.scrollTop - el.clientHeight)).toBeLessThan(2);
            await output.evaluate(el => { el.scrollTop = 0; });
            expect(await output.evaluate(el => el.scrollTop)).toBe(0);
            expect(await output.evaluate(el => getComputedStyle(el).overflowY)).toBe("auto");
            if (viewport.width === 390) {
                await page.setViewportSize({ width: 844, height: 390 });
                await expectLogInViewport(page);
                await page.setViewportSize(viewport);
                await expectLogInViewport(page);
            }
            const documentId = await page.evaluate(() => performance.timeOrigin);
            await testInfo.attach("log-panel", {
                body: await page.screenshot({ path: testInfo.outputPath("log-panel.png") }),
                contentType: "image/png",
            });
            await page.locator("#sysResponseCloseAction").click();
            await expect(page.locator("#sysResponse")).toBeHidden();
            expect(await page.evaluate(() => performance.timeOrigin)).toBe(documentId);
            await expect(page.locator("body")).not.toHaveClass(/modal-open/);
        });
    }
}

test("log dialog ignores clicks outside the panel", async ({ page }) => {
    await openLog(page);
    await page.mouse.click(4, 4);
    await expect(page.locator("#sysResponse")).toBeVisible();
    await expect(page.locator("body")).toHaveClass(/modal-open/);
    // Dismissing stays an explicit action: only the footer button closes it.
    await page.locator("#sysResponseCloseAction").click();
    await expect(page.locator("#sysResponse")).toBeHidden();
    await expect(page.locator("body")).not.toHaveClass(/modal-open/);
});

test("log updates preserve reading position and follow only at the bottom", async ({ page }) => {
    await openLog(page);
    await deliverLog(page, log);
    const output = page.locator("#sysPre");
    await output.evaluate(el => { el.scrollTop = 40; });
    await deliverLog(page, "", log.length);
    expect(await output.evaluate(el => el.scrollTop)).toBe(40);
    await deliverLog(page, "new output\n", log.length);
    expect(await output.evaluate(el => el.scrollTop)).toBe(40);
    await output.evaluate(el => { el.scrollTop = el.scrollHeight; });
    await deliverLog(page, "more output\n", log.length + "new output\n".length);
    await expect.poll(() => output.evaluate(el => el.scrollHeight - el.scrollTop - el.clientHeight)).toBeLessThan(2);
});
