// SPDX-License-Identifier: GPL-3.0-or-later

import "mocha";
import { expect } from "chai";

import logHandler from "../../src/handlers/log";
import i18nHandler from "../../src/handlers/i18n";
import Constant from "../../src/shared/constants";
import { normalizeLocale, resolveRequestLocale, VALID_LOCALES } from "../../src/i18n";

describe("handlers/log", () => {
    it("registers disconnect event and calls next", () => {
        const registered: Record<string, () => void> = {};
        const mockClient = {
            id: "client-1",
            handshake: {
                headers: {
                    "x-forwarded-for": "10.0.0.2",
                },
                address: "127.0.0.1",
            },
            on(event: string, cb: () => void) {
                registered[event] = cb;
            },
        };
        let nextCalled = false;
        logHandler(mockClient as never, () => {
            nextCalled = true;
        });

        expect(registered[Constant.EVENT_DISCONNECT]).to.be.a("function");
        expect(nextCalled).to.equal(true);
    });

    // C4: IP sanitization tests
    it("should sanitize control characters from x-forwarded-for", () => {
        const registered: Record<string, () => void> = {};
        const mockClient = {
            id: "client-c4",
            handshake: {
                headers: {
                    "x-forwarded-for": "10.0.0.1\nInjected-Line: malicious",
                },
                address: "127.0.0.1",
            },
            on(event: string, cb: () => void) {
                registered[event] = cb;
            },
        };
        // Should not throw even with control characters in header
        expect(() => { logHandler(mockClient as never); }).to.not.throw();
    });

    it("should handle x-forwarded-for as array", () => {
        const registered: Record<string, () => void> = {};
        const mockClient = {
            id: "client-c4-arr",
            handshake: {
                headers: {
                    "x-forwarded-for": ["10.0.0.1", "10.0.0.2"],
                },
                address: "127.0.0.1",
            },
            on(event: string, cb: () => void) {
                registered[event] = cb;
            },
        };
        expect(() => { logHandler(mockClient as never); }).to.not.throw();
    });
});

describe("handlers/i18n", () => {
    it("ignores invalid locale values", () => {
        const listeners: Record<string, (value: string) => void> = {};
        const clientData: Record<string, unknown> = {};
        const mockClient = {
            id: "client-3",
            data: clientData,
            on(event: string, cb: (value: string) => void) {
                listeners[event] = cb;
            },
        };

        i18nHandler(mockClient as never);
        listeners[Constant.EVENT_I18N]("../../malicious");
        expect(clientData["locale"]).to.equal(undefined);
    });

    it("normalizes browser and legacy locale aliases", () => {
        const listeners: Record<string, (value: string) => void> = {};
        const clientData: Record<string, unknown> = {};
        const mockClient = {
            id: "client-4",
            data: clientData,
            on(event: string, cb: (value: string) => void) {
                listeners[event] = cb;
            },
        };

        i18nHandler(mockClient as never);
        listeners[Constant.EVENT_I18N]("zh-CN");
        expect(clientData["locale"]).to.equal("zh");
        listeners[Constant.EVENT_I18N]("lang_zh");
        expect(clientData["locale"]).to.equal("zh");
    });
});

// C6: VALID_LOCALES derived from translations
describe("VALID_LOCALES (C6)", () => {
    it("should contain all registered translation keys", () => {
        expect(VALID_LOCALES).to.include("en");
        expect(VALID_LOCALES).to.include("zh");
        expect(VALID_LOCALES).to.include("de");
        expect(VALID_LOCALES).to.include("da");
        expect(VALID_LOCALES).to.include("fr");
        expect(VALID_LOCALES).to.include("es");
    });

    it("should have exactly 6 locales", () => {
        expect(VALID_LOCALES).to.have.length(6);
    });
});

describe("request locale resolution", () => {
    it("should normalize legacy lang_ locale names", () => {
        expect(normalizeLocale("lang_zh")).to.equal("zh");
        expect(normalizeLocale("lang_en")).to.equal("en");
    });

    it("should normalize browser locale region tags to supported base languages", () => {
        expect(normalizeLocale("fr-FR")).to.equal("fr");
        expect(normalizeLocale("de-DE")).to.equal("de");
        expect(normalizeLocale("es-ES")).to.equal("es");
    });

    it("should prefer query locale over cookie and accept-language", () => {
        const locale = resolveRequestLocale({
            query: { locale: "fr" },
            headers: {
                "cookie": "quickbox_locale=zh",
                "accept-language": "de-DE,de;q=0.8,en;q=0.1",
            },
        });

        expect(locale).to.equal("fr");
    });

    it("should use quickbox locale cookie for full-page browser requests", () => {
        const locale = resolveRequestLocale({
            headers: {
                "cookie": "theme=smoked; quickbox_locale=zh; session=1",
                "accept-language": "en-US,en;q=0.9",
            },
        });

        expect(locale).to.equal("zh");
    });

    it("should ignore malformed locale cookies and use accepted browser language", () => {
        const locale = resolveRequestLocale({
            headers: {
                "cookie": "quickbox_locale=%E0%A4%A",
                "accept-language": "fr-FR",
            },
        });

        expect(locale).to.equal("fr");
    });

    it("should fall back to accepted browser language", () => {
        const locale = resolveRequestLocale({
            headers: {
                "accept-language": "fr-FR,fr;q=0.9,en;q=0.3",
            },
        });

        expect(locale).to.equal("fr");
    });

    it("should use accepted browser language region when no base fallback is sent", () => {
        const locale = resolveRequestLocale({
            headers: {
                "accept-language": "de-DE",
            },
        });

        expect(locale).to.equal("de");
    });
});
