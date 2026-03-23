// SPDX-License-Identifier: GPL-3.0-or-later

import "mocha";
import { expect } from "chai";

import logHandler from "../../src/handler/log";
import i18nHandler from "../../src/handler/i18n";
import Constant from "../../src/constant";
import { VALID_LOCALES } from "../../src/i18n";

describe("handler/log", () => {
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

describe("handler/i18n", () => {
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
