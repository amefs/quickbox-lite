// SPDX-License-Identifier: GPL-3.0-or-later
import { expect, test } from "@playwright/test";

for (const theme of ["defaulted", "smoked"] as const) {
    test(`${theme}: debug widget preview uses the selected dashboard styles`, async ({ page }) => {
        const origins = JSON.parse(process.env.QB_MIGRATION_ORIGINS ?? "{}") as Record<string, string>;
        const requests: string[] = [];
        page.on("request", (request) => { requests.push(request.url()); });

        const response = await page.goto(`${origins[theme]}/debug`);
        expect(response?.status()).toBe(200);
        await expect(page.locator("#result-rendered")).toHaveAttribute("data-theme", theme);
        await expect.poll(() => page.evaluate(() => {
            const shadow = document.querySelector("#result-rendered")?.shadowRoot;
            return [...(shadow?.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]') ?? [])]
                .map((link) => ({ path: new URL(link.href).pathname, loaded: Boolean(link.sheet) }));
        })).toEqual(expect.arrayContaining([
            { path: "/debug/assets/css/dashboard-foundation.css", loaded: true },
            { path: `/debug/assets/css/dashboard-theme-${theme}.css`, loaded: true },
        ]));

        await page.locator("[data-url='/node/up']").click();
        await expect(page.locator("#result-rendered .widget-content")).toContainText("15");
        expect(requests.some((url) => /quick\.css|\/lib\/bootstrap\//.test(url))).toBe(false);
    });
}
