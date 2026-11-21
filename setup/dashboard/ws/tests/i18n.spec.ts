// SPDX-License-Identifier: GPL-3.0-or-later

import { expect } from "chai";

import da from "../../web/src/i18n/locales/lang_da.json";
import de from "../../web/src/i18n/locales/lang_de.json";
import en from "../../web/src/i18n/locales/lang_en.json";
import es from "../../web/src/i18n/locales/lang_es.json";
import fr from "../../web/src/i18n/locales/lang_fr.json";
import zh from "../../web/src/i18n/locales/lang_zh-Hans-CN.json";

const translations: Record<string, Record<string, string>> = { da, de, es, fr, zh };

function placeholders(value: string): string[] {
    return Array.from(value.matchAll(/(?:%\{([^}]+)\}|\{\{([^}]+)\}\})/g), (match) => match[0].startsWith("%") ? match[0].slice(2, -1) : match[0].slice(2, -2)).sort();
}

describe("dashboard translations", () => {
    for (const [locale, messages] of Object.entries(translations)) {
        it(`${locale} has the source keys and preserves interpolation placeholders`, () => {
            expect(Object.keys(messages).sort()).to.deep.equal(Object.keys(en).sort());
            for (const [key, source] of Object.entries(en)) {
                expect(messages[key].trim(), `${locale}: ${key}`).not.to.equal("");
                expect(placeholders(messages[key]), `${locale}: ${key}`).to.deep.equal(placeholders(source));
            }
        });
    }
});
