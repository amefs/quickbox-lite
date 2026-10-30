// SPDX-License-Identifier: GPL-3.0-or-later

import { expect } from "chai";

import da from "../../lang/lang_da.json";
import de from "../../lang/lang_de.json";
import en from "../../lang/lang_en.json";
import es from "../../lang/lang_es.json";
import fr from "../../lang/lang_fr.json";
import zh from "../../lang/lang_zh-Hans-CN.json";
import { I18n } from "../src/vendor/i18n";

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

    it("can fall back to English when a translation is missing", () => {
        const i18n = new I18n({ en: { example: "Example" }, fr: {} }, { locale: "fr", enableFallback: true });
        expect(i18n.t("example")).to.equal("Example");
    });
});
