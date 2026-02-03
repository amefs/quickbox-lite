// SPDX-License-Identifier: GPL-3.0-or-later

import "mocha";
import { expect } from "chai";

import logHandler from "../../src/handler/log";
import i18nHandler from "../../src/handler/i18n";
import Constant from "../../src/constant";
import i18n from "../../src/i18n";

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
});

describe("handler/i18n", () => {
    it("updates locale when EVENT_I18N fires", () => {
        const previousLocale = i18n.locale;
        const listeners: Record<string, (value: string) => void> = {};
        const mockClient = {
            id: "client-2",
            on(event: string, cb: (value: string) => void) {
                listeners[event] = cb;
            },
        };

        i18nHandler(mockClient as never);
        listeners[Constant.EVENT_I18N]("zh");
        expect(i18n.locale).to.equal("zh");

        // reset locale to avoid leaking changes to other tests
        i18n.locale = previousLocale;
    });
});
