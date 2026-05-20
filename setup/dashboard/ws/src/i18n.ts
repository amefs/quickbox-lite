import { AsyncLocalStorage } from "async_hooks";

import { I18n } from "./vendor/i18n";

import da from "../lang/lang_da.json";
import de from "../lang/lang_de.json";
import en from "../lang/lang_en.json";
import es from "../lang/lang_es.json";
import fr from "../lang/lang_fr.json";
import zh from "../lang/lang_zh-Hans-CN.json";

const translations = { da, de, en, es, fr, zh };
const baseI18n = new I18n(translations);
const i18nStorage = new AsyncLocalStorage<I18n>();
const localeAliases: Record<string, string> = {
    "zh-cn": "zh",
    "zh-hans-cn": "zh",
};

function getActiveI18n(): I18n {
    return i18nStorage.getStore() ?? baseI18n;
}

export function withLocale<T>(locale: string, callback: () => T | Promise<T>): T | Promise<T> {
    const scopedI18n = new I18n(translations, { locale: normalizeLocale(locale) });
    return i18nStorage.run(scopedI18n, callback);
}

export const VALID_LOCALES = Object.keys(translations);

export function normalizeLocale(value: unknown): string {
    if (typeof value !== "string") {
        return "en";
    }
    const normalized = value.toLowerCase().replace("_", "-").replace(/^lang-/, "");
    const targetLocale = localeAliases[normalized] ?? normalized;
    return VALID_LOCALES.includes(targetLocale) ? targetLocale : "en";
}

const i18n = new Proxy(baseI18n, {
    get(_target, property) {
        const activeI18n = getActiveI18n();
        const value = Reflect.get(activeI18n, property) as unknown;
        if (typeof value === "function") {
            return (...args: unknown[]): unknown => Reflect.apply(value, activeI18n, args) as unknown;
        }
        return value;
    },
    set(_target, property, value) {
        const activeI18n = getActiveI18n();
        Reflect.set(activeI18n, property, value);
        return true;
    },
});

export default i18n;
