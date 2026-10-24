// SPDX-License-Identifier: GPL-3.0-or-later

import { test, expect, type Page } from "@playwright/test";
import path from "node:path";

import { resetMockProfile, setMockProfile } from "./support/helpers";

test.beforeEach(async ({ page }) => {
    await resetMockProfile(page);
});
const log = Array.from({ length: 160 }, (_, index) => `第 ${index + 1} 行：\u001b[32m任务输出\u001b[0m ${"long-path/".repeat(16)} <script>unsafe()</script>\n`).join("");

async function openLog(page: Page) {
    await setMockProfile(page, "installing");
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

// One shared rule for every dialog footer button, so a single button cannot
// drift away from the rest: the theme's base .btn metrics (14px on a 20px
// line), 10px top / 9px bottom padding, a 1px border, and no min-width or
// min-height of its own — a 41px tall control. Both shapes seen in review
// break it: the btn-xs speck (22px) and a hand-tuned min-height slab (38-46px).
// A deliberate change to the theme's .btn has to update this rule as well.
const FOOTER_BUTTON = {
    fontSize: 14,
    lineHeight: 20,
    paddingTop: 10,
    paddingRight: 12,
    paddingBottom: 9,
    paddingLeft: 12,
    borderY: 2,
    height: 41,
};

async function expectFooterButtonsFollowTheRule(page: Page) {
    const buttons = await page.evaluate(() => Array.from(document.querySelectorAll(".modal-footer .btn")).map(el => {
        const style = getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        const dialog = el.closest(".modal");
        return {
            dialog: dialog instanceof HTMLElement ? dialog.id : "",
            label: (el.textContent ?? "").trim(),
            visible: rect.height > 0,
            fontSize: parseFloat(style.fontSize),
            lineHeight: parseFloat(style.lineHeight),
            paddingTop: parseFloat(style.paddingTop),
            paddingRight: parseFloat(style.paddingRight),
            paddingBottom: parseFloat(style.paddingBottom),
            paddingLeft: parseFloat(style.paddingLeft),
            borderY: parseFloat(style.borderTopWidth) + parseFloat(style.borderBottomWidth),
            minWidth: style.minWidth,
            minHeight: style.minHeight,
            height: rect.height,
        };
    }));

    // Every dialog on the page is checked, not just the open one.
    expect(buttons.length).toBeGreaterThan(3);
    expect(buttons.some(button => button.visible)).toBe(true);
    for (const button of buttons) {
        const who = `${button.dialog || "dialog"} footer button "${button.label}"`;
        expect(button.fontSize, who).toBe(FOOTER_BUTTON.fontSize);
        expect(button.lineHeight, who).toBe(FOOTER_BUTTON.lineHeight);
        expect(button.paddingTop, who).toBe(FOOTER_BUTTON.paddingTop);
        expect(button.paddingRight, who).toBe(FOOTER_BUTTON.paddingRight);
        expect(button.paddingBottom, who).toBe(FOOTER_BUTTON.paddingBottom);
        expect(button.paddingLeft, who).toBe(FOOTER_BUTTON.paddingLeft);
        expect(button.borderY, who).toBe(FOOTER_BUTTON.borderY);
        expect(button.minWidth, who).toBe("0px");
        expect(button.minHeight, who).toBe("0px");
        if (button.visible) {
            // Height is padding + text + border, never inflated by a min-height.
            expect(button.height, who).toBeCloseTo(FOOTER_BUTTON.height, 0);
        }
    }
}

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
            await expectFooterButtonsFollowTheRule(page);
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
    // Viewing a log changes nothing, so the action says so instead of "cancel".
    await expect(page.locator("#sysResponseCloseAction")).toHaveText("关闭");
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
