// SPDX-License-Identifier: GPL-3.0-or-later
//
// Shared helpers for the Playwright specs.
//
// Playwright only collects `*.spec.ts` files, so importing from here does not
// register tests. `playwright.config.ts` derives `WS_BASE_URL` (including the
// `/ws` prefix used behind Nginx) before the specs are loaded; the fallback
// below only covers a spec run outside the Playwright runner.

import { expect, type Page, type TestInfo } from "@playwright/test";

export const WS_BASE_URL =
    process.env.WS_BASE_URL ||
    `http://127.0.0.1:${process.env.TEST_WS_PORT || "8575"}`;

/** Profile the mock server starts with; also the state every test starts from. */
export const DEFAULT_MOCK_PROFILE = "partial-running";

export async function setMockProfile(page: Page, profile: string): Promise<void> {
    const response = await page.request.post(`${WS_BASE_URL}/test/profile`, {
        data: { profile },
    });
    expect(response.ok(), `could not switch the mock profile to "${profile}"`).toBeTruthy();
}

/**
 * Return the shared mock server to its default profile. Every spec runs
 * `resetMockProfile` in `beforeEach`, so a test never depends on the profile a
 * previously executed file left behind.
 */
export async function resetMockProfile(page: Page): Promise<void> {
    await setMockProfile(page, DEFAULT_MOCK_PROFILE);
}

/** Attach a named full-page screenshot to the HTML report. */
export async function snap(page: Page, testInfo: TestInfo, name: string): Promise<void> {
    const screenshot = await page.screenshot({ fullPage: true });
    await testInfo.attach(name, {
        body: screenshot,
        contentType: "image/png",
    });
}

/** Assert that keyboard focus currently sits inside `selector`. */
export async function expectFocusInside(page: Page, selector: string): Promise<void> {
    await expect.poll(() => page.evaluate((sel) => {
        const container = document.querySelector(sel);
        return Boolean(container && document.activeElement && container.contains(document.activeElement));
    }, selector), { timeout: 5_000 }).toBe(true);
}

/** Text rendered in the debug console's shadow root. */
export async function getRenderedWidgetText(page: Page): Promise<string> {
    return page.locator("#result-rendered").evaluate((el) => {
        const host = el as HTMLElement;
        return host.shadowRoot?.textContent ?? "";
    });
}

/** Resolves once the dashboard socket exists and is connected. */
export async function waitForSocket(page: Page): Promise<void> {
    await expect.poll(() => page.evaluate(() => {
        return Boolean((window as unknown as { socket?: { connected?: boolean } }).socket?.connected);
    }), { timeout: 15_000 }).toBe(true);
}
