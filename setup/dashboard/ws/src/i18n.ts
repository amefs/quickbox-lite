import { AsyncLocalStorage } from "async_hooks";

import { I18n } from "./vendor/i18n";

import da from "../../lang/lang_da.json";
import de from "../../lang/lang_de.json";
import en from "../../lang/lang_en.json";
import es from "../../lang/lang_es.json";
import fr from "../../lang/lang_fr.json";
import zh from "../../lang/lang_zh-Hans-CN.json";

const translations = { da, de, en, es, fr, zh };
const baseI18n = new I18n(translations);
const i18nStorage = new AsyncLocalStorage<I18n>();
const localeAliases: Record<string, string> = {
    "zh-cn": "zh",
    "zh-hans-cn": "zh",
};
const DEFAULT_LOCALE = "en";

function getActiveI18n(): I18n {
    return i18nStorage.getStore() ?? baseI18n;
}

export function withLocale<T>(locale: string, callback: () => T | Promise<T>): T | Promise<T> {
    const scopedI18n = new I18n(translations, { locale: normalizeLocale(locale) });
    return i18nStorage.run(scopedI18n, callback);
}

export const VALID_LOCALES = Object.keys(translations);

export function parseLocale(value: unknown): string | null {
    if (typeof value !== "string") {
        return null;
    }
    const normalized = value.toLowerCase().replace(/_/g, "-").replace(/^lang-/, "");
    const targetLocale = localeAliases[normalized] ?? normalized;
    if (VALID_LOCALES.includes(targetLocale)) {
        return targetLocale;
    }
    const primaryLocale = targetLocale.split("-")[0];
    return VALID_LOCALES.includes(primaryLocale) ? primaryLocale : null;
}

export function normalizeLocale(value: unknown): string {
    return parseLocale(value) ?? DEFAULT_LOCALE;
}

function parseCookieLocale(cookieHeader: unknown): string | null {
    if (typeof cookieHeader !== "string") {
        return null;
    }
    for (const cookie of cookieHeader.split(";")) {
        const [rawName, ...rawValue] = cookie.trim().split("=");
        if (rawName !== "quickbox_locale" || rawValue.length === 0) {
            continue;
        }
        try {
            return parseLocale(decodeURIComponent(rawValue.join("=")));
        } catch {
            return null;
        }
    }
    return null;
}

function parseAcceptLanguageLocale(header: unknown): string | null {
    if (typeof header !== "string") {
        return null;
    }
    const candidates = header
        .split(",")
        .map((part) => {
            const [localePart, ...params] = part.trim().split(";");
            const quality = params
                .map((param) => param.trim().match(/^q=([0-9.]+)$/)?.[1])
                .find((value): value is string => typeof value === "string");
            return { locale: parseLocale(localePart), quality: quality ? Number(quality) : 1 };
        })
        .filter((entry): entry is { locale: string; quality: number } => entry.locale !== null && Number.isFinite(entry.quality) && entry.quality > 0)
        .sort((left, right) => right.quality - left.quality);

    return candidates[0]?.locale ?? null;
}

export interface LocaleRequestLike {
    query?: Record<string, unknown>;
    headers?: Record<string, unknown>;
    header?: (name: string) => string | undefined;
}

export function resolveRequestLocale(req: LocaleRequestLike): string {
    const queryLocale = typeof req.query?.locale === "string" ? parseLocale(req.query.locale) : null;
    if (queryLocale) {
        return queryLocale;
    }
    const headerLocale = parseLocale(req.header?.("x-quickbox-locale") ?? req.headers?.["x-quickbox-locale"]);
    if (headerLocale) {
        return headerLocale;
    }
    const cookieLocale = parseCookieLocale(req.header?.("cookie") ?? req.headers?.cookie);
    if (cookieLocale) {
        return cookieLocale;
    }
    return parseAcceptLanguageLocale(req.header?.("accept-language") ?? req.headers?.["accept-language"]) ?? DEFAULT_LOCALE;
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
