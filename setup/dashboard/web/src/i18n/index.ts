// SPDX-License-Identifier: GPL-3.0-or-later

import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import type { Locale as AntdLocale } from "antd/es/locale";
import daDK from "antd/locale/da_DK";
import deDE from "antd/locale/de_DE";
import enUS from "antd/locale/en_US";
import esES from "antd/locale/es_ES";
import frFR from "antd/locale/fr_FR";
import zhCN from "antd/locale/zh_CN";

import da from "./locales/lang_da.json";
import de from "./locales/lang_de.json";
import en from "./locales/lang_en.json";
import es from "./locales/lang_es.json";
import fr from "./locales/lang_fr.json";
import zh from "./locales/lang_zh-Hans-CN.json";

export type DashboardLocale = "da" | "de" | "en" | "es" | "fr" | "zh";

export const VALID_LOCALES: readonly DashboardLocale[] = ["da", "de", "en", "es", "fr", "zh"];
export const DEFAULT_LOCALE: DashboardLocale = "en";

const localeAliases: Record<string, DashboardLocale> = {
    "zh-cn": "zh",
    "zh-hans-cn": "zh",
};

const ANTD_LOCALES: Record<DashboardLocale, AntdLocale> = {
    da: daDK,
    de: deDE,
    en: enUS,
    es: esES,
    fr: frFR,
    zh: zhCN,
};

export function parseLocale(value: unknown): DashboardLocale | null {
    if (typeof value !== "string") {
        return null;
    }
    const normalized = value.trim().toLowerCase().replace(/_/g, "-").replace(/^lang-/, "");
    if (!normalized) {
        return null;
    }
    const aliased = localeAliases[normalized];
    if (aliased) {
        return aliased;
    }
    if ((VALID_LOCALES as readonly string[]).includes(normalized)) {
        return normalized as DashboardLocale;
    }
    const primary = normalized.split("-")[0];
    if ((VALID_LOCALES as readonly string[]).includes(primary)) {
        return primary as DashboardLocale;
    }
    return null;
}

export function normalizeLocale(value: unknown): DashboardLocale {
    return parseLocale(value) ?? DEFAULT_LOCALE;
}

function readCookieLocale(): DashboardLocale | null {
    if (typeof document === "undefined") {
        return null;
    }
    const match = /(?:^|;\s*)quickbox_locale=([^;]+)/.exec(document.cookie);
    return match ? parseLocale(decodeURIComponent(match[1])) : null;
}

function readQueryLocale(): DashboardLocale | null {
    if (typeof window === "undefined") {
        return null;
    }
    const params = new URLSearchParams(window.location.search);
    return parseLocale(params.get("locale")) ?? parseLocale(params.get("lang"));
}

export function detectInitialLocale(fallbackLocale?: unknown): DashboardLocale {
    return (
        readQueryLocale() ??
        readCookieLocale() ??
        parseLocale(fallbackLocale) ??
        (typeof navigator !== "undefined" ? parseLocale(navigator.language) : null) ??
        DEFAULT_LOCALE
    );
}

void i18n.use(initReactI18next).init({
    resources: {
        da: { translation: da },
        de: { translation: de },
        en: { translation: en },
        es: { translation: es },
        fr: { translation: fr },
        zh: { translation: zh },
    },
    lng: DEFAULT_LOCALE,
    fallbackLng: DEFAULT_LOCALE,
    keySeparator: false,
    nsSeparator: false,
    interpolation: {
        escapeValue: false,
    },
    react: {
        transSupportBasicHtmlNodes: true,
        transKeepBasicHtmlNodesFor: ["br", "strong", "b", "code", "i", "p"],
    },
});

export function setLocale(nextLocale: unknown, persistCookie = true): DashboardLocale {
    const normalized = normalizeLocale(nextLocale);
    if (typeof document !== "undefined") {
        document.documentElement.lang = normalized;
        if (persistCookie) {
            document.cookie = `quickbox_locale=${encodeURIComponent(normalized)}; path=/; max-age=31536000; SameSite=Lax`;
        }
    }
    if (i18n.language !== normalized) {
        void i18n.changeLanguage(normalized);
    }
    return normalized;
}

export function getAntdLocale(locale: unknown): AntdLocale {
    return ANTD_LOCALES[normalizeLocale(locale)];
}

export default i18n;
