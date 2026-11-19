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
    // Any entry opens the same dialog: the install-lock notice in the package
    // panel, the running-task banner, an install button — they all behave alike.
    const trigger = page.locator("#pmc_widget button", { hasText: "查看日志" });
    await expect(trigger).toBeVisible();
    await expect.poll(() => page.evaluate(() => Boolean((window as unknown as { socket?: { connected: boolean } }).socket?.connected))).toBe(true);
    await page.evaluate(() => (window as unknown as { socket: { disconnect(): void } }).socket.disconnect());
    await trigger.click();
    await expect(page.locator("#sysResponse")).toBeVisible();
    await page.locator("#sysResponse").evaluate(async el => {
        await Promise.all(el.getAnimations({ subtree: true }).map(animation => animation.finished));
    });
}

async function deliverLog(page: Page, content: string, start = 0, epoch = "mobile-log") {
    await page.evaluate(({ content, start, epoch }) => {
        const island = (window as unknown as {
            quickboxSystemResponseIsland?: { onMessage: (payload: unknown) => boolean };
        }).quickboxSystemResponseIsland;
        if (!island?.onMessage({ content, start, end: start + content.length, size: start + content.length, epoch })) {
            throw new Error("the system response view rejected the log payload");
        }
    }, { content, start, epoch });
}

async function expectLogInViewport(page: Page) {
    const viewport = page.viewportSize()!;
    for (const selector of ["#sysResponse .ant-modal", "#sysResponse .ant-modal-title", "#sysResponseDismiss", "#sysPre", "#sysResponseCloseAction"]) {
        const box = await page.locator(selector).boundingBox();
        expect(box).not.toBeNull();
        expect(box!.x).toBeGreaterThanOrEqual(0);
        expect(box!.y).toBeGreaterThanOrEqual(0);
        expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width);
        expect(box!.y + box!.height, selector).toBeLessThanOrEqual(viewport.height);
    }
}

// Footer buttons must stay consistent inside each dialog and readable: equal
// height and font size across siblings, equal min-size rules, and a label that
// fits without clipping. Theme metrics stay in the theme stylesheets.
async function expectFooterButtonsConsistent(page: Page) {
    const buttons = await page.evaluate(() => Array.from(document.querySelectorAll("#sysResponse .ant-modal-footer .ant-btn")).map(el => {
        const style = getComputedStyle(el);
        const rect = el.getBoundingClientRect();
            const dialog = el.closest("#sysResponse");
        return {
            dialog: dialog instanceof HTMLElement ? dialog.id : "",
            label: (el.textContent ?? "").trim(),
            visible: rect.height > 0,
            fontSize: parseFloat(style.fontSize),
            width: rect.width,
            height: rect.height,
            minWidth: style.minWidth,
            minHeight: style.minHeight,
            clipped: el.scrollHeight > el.clientHeight + 1,
        };
    }));

    expect(buttons.length).toBeGreaterThan(0);
    expect(buttons.some(button => button.visible)).toBe(true);
    const byDialog = new Map<string, typeof buttons>();
    for (const button of buttons) {
        const list = byDialog.get(button.dialog) ?? [];
        list.push(button);
        byDialog.set(button.dialog, list);
    }
    for (const [dialog, list] of byDialog) {
        const visible = list.filter(button => button.visible);
        if (visible.length === 0) continue;
        const first = visible[0];
        for (const button of visible) {
            const who = `${dialog || "dialog"} footer button "${button.label}"`;
            expect(button.fontSize, who).toBeCloseTo(first.fontSize, 0);
            expect(button.height, who).toBeCloseTo(first.height, 0);
            expect(button.minWidth, who).toBe(first.minWidth);
            expect(button.minHeight, who).toBe(first.minHeight);
            expect(parseFloat(button.minWidth) || 0, who).toBeLessThanOrEqual(first.width);
            expect(parseFloat(button.minHeight) || 0, who).toBeLessThanOrEqual(first.height);
            expect(button.clipped, who).toBe(false);
        }
    }
}

// Themes cross the smallest and a desktop viewport; the intermediate phone and
// landscape sizes run once on the default theme.
const EXTRA_VIEWPORTS = [{ width: 390, height: 844 }, { width: 844, height: 390 }];

for (const theme of ["smoked", "defaulted"]) {
    for (const viewport of [{ width: 320, height: 568 }, { width: 1280, height: 800 }, ...(theme === "smoked" ? EXTRA_VIEWPORTS : [])]) {
        test(`${theme}: log panel fits and scrolls at ${viewport.width}x${viewport.height}`, async ({ page }, testInfo) => {
            await page.setViewportSize(viewport);
            await page.route("**/skins/quick.css", route => route.fulfill({
                path: path.resolve(__dirname, `../../setup/themes/${theme}/skins/quick.css`),
                contentType: "text/css",
            }));
            await openLog(page);
            await expectLogInViewport(page);
            await expectFooterButtonsConsistent(page);
            await deliverLog(page, log);
            await expect(page.locator("#sshoutput")).toContainText("第 160 行");
            await expect(page.locator("#sshoutput script")).toHaveCount(0);
            await expect(page.locator("#sshoutput")).toContainText("<script>unsafe()</script>");
            await expectLogInViewport(page);
            const output = page.locator("#sysPre");
            const modalBody = page.locator("#sysResponse .qb-system-response-body");
            expect(await modalBody.evaluate(el => el.scrollHeight)).toBeLessThanOrEqual(await modalBody.evaluate(el => el.clientHeight));
            expect(await output.evaluate(el => el.scrollHeight)).toBeGreaterThan(await output.evaluate(el => el.clientHeight));
            expect(await output.evaluate(el => el.scrollWidth)).toBeLessThanOrEqual(await output.evaluate(el => el.clientWidth));
            await expect.poll(() => output.evaluate(el => el.scrollHeight - el.scrollTop - el.clientHeight)).toBeLessThan(2);
            const bounds = await page.evaluate(() => {
                const body = document.querySelector("#sysResponse .qb-system-response-body")!.getBoundingClientRect();
                const pre = document.querySelector("#sysPre")!.getBoundingClientRect();
                const out = document.querySelector("#sshoutput")!;
                const range = document.createRange();
                range.selectNodeContents(out.lastChild ?? out);
                const lastRect = range.getBoundingClientRect();
                return {
                    preTop: pre.top,
                    preBottom: pre.bottom,
                    bodyTop: body.top,
                    bodyBottom: body.bottom,
                    lastBottom: lastRect.bottom,
                };
            });
            expect(bounds.preTop).toBeGreaterThanOrEqual(bounds.bodyTop - 1);
            expect(bounds.preBottom).toBeLessThanOrEqual(bounds.bodyBottom + 1);
            expect(bounds.lastBottom).toBeLessThanOrEqual(bounds.preBottom + 2);
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
            // The header X is the dismiss-only affordance: it hides the dialog
            // and leaves the document alone.
            await page.locator("#sysResponseDismiss").click();
            await expect(page.locator("#sysResponse")).toBeHidden();
            expect(await page.evaluate(() => performance.timeOrigin)).toBe(documentId);
            await expect(page.locator("#sysResponse")).toBeHidden();
        });
    }
}

test("log dialog ignores clicks outside the panel", async ({ page }) => {
    await openLog(page);
    await expect(page.locator("#sysResponseCloseAction")).toHaveText("关闭 & 刷新");
    await expect(page.locator("#sysResponseDismiss")).toHaveAttribute("aria-label", "关闭");
    await page.mouse.click(4, 4);
    await expect(page.locator("#sysResponse")).toBeVisible();
    await expect(page.locator("#sysResponse")).toBeVisible();
    // Dismissing stays an explicit action: only the footer button or the header
    // X closes it, and Escape is bound to the same dismiss path as the X.
    await page.keyboard.press("Escape");
    await expect(page.locator("#sysResponse")).toBeHidden();
    await expect(page.locator("#sysResponse")).toBeHidden();
});

test("closing the log dialog reloads the page from the footer button only", async ({ page }) => {
    await openLog(page);
    const before = await page.evaluate(() => performance.timeOrigin);
    // A command that is still running must not hold the reload back: the
    // decision is taken while the panel closes, not when an exec reply lands.
    await Promise.all([
        page.waitForEvent("load"),
        page.locator("#sysResponseCloseAction").click(),
    ]);
    expect(await page.evaluate(() => performance.timeOrigin)).not.toBe(before);
});

test("reopening the log dialog starts a fresh session with the same close actions", async ({ page }) => {
    await openLog(page);
    await deliverLog(page, log);
    await expect(page.locator("#sshoutput")).toContainText("第 160 行");
    await page.locator("#sysResponseDismiss").click();
    await expect(page.locator("#sysResponse")).toBeHidden();

    await page.locator("#pmc_widget button", { hasText: "查看日志" }).click();
    await expect(page.locator("#sysResponse")).toBeVisible();
    // Same two affordances as the first time: the previous close changed nothing.
    await expect(page.locator("#sysResponseCloseAction")).toHaveText("关闭 & 刷新");
    await expect(page.locator("#sysResponseDismiss")).toBeVisible();
    // And the view is not a leftover buffer — it is wiped before the first read.
    await expect(page.locator("#sshoutput")).toHaveText("");
});

test("a new log epoch replaces output at the same byte offset", async ({ page }) => {
    await openLog(page);
    const previous = "previous task output\n";
    const replacement = "replaced task result\n";
    expect(replacement.length).toBe(previous.length);
    await deliverLog(page, previous, 0, "epoch-one");
    await expect(page.locator("#sshoutput")).toContainText("previous task output");
    const firstCursor = await page.evaluate(() => (window as unknown as {
        quickboxSystemResponseIsland: { getOutputCursor: () => { end: number; epoch?: string } };
    }).quickboxSystemResponseIsland.getOutputCursor());
    expect(firstCursor).toEqual({ end: previous.length, epoch: "epoch-one" });

    await deliverLog(page, replacement, 0, "epoch-two");
    await expect(page.locator("#sshoutput")).toContainText("replaced task result");
    await expect(page.locator("#sshoutput")).not.toContainText("previous task output");
    const nextCursor = await page.evaluate(() => (window as unknown as {
        quickboxSystemResponseIsland: { getOutputCursor: () => { end: number; epoch?: string } };
    }).quickboxSystemResponseIsland.getOutputCursor());
    expect(nextCursor).toEqual({ end: replacement.length, epoch: "epoch-two" });
});

test("log updates preserve reading position and follow only at the bottom", async ({ page }) => {
    await openLog(page);
    await deliverLog(page, log);
    const output = page.locator("#sysPre");
    await output.evaluate(el => new Promise<void>(resolve => {
        el.addEventListener("scroll", () => { resolve(); }, { once: true });
        el.scrollTop = 40;
    }));
    await deliverLog(page, "", log.length);
    expect(await output.evaluate(el => el.scrollTop)).toBe(40);
    await deliverLog(page, "new output\n", log.length);
    expect(await output.evaluate(el => el.scrollTop)).toBe(40);
    await output.evaluate(el => new Promise<void>(resolve => {
        el.addEventListener("scroll", () => { resolve(); }, { once: true });
        el.scrollTop = el.scrollHeight;
    }));
    await deliverLog(page, "more output\n", log.length + "new output\n".length);
    await expect.poll(() => output.evaluate(el => el.scrollHeight - el.scrollTop - el.clientHeight)).toBeLessThan(2);
});
