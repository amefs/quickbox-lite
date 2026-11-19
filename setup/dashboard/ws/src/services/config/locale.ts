const localeAliases: Record<string, string> = {
    "zh-cn": "zh",
    "zh-hans-cn": "zh",
};
const DEFAULT_LOCALE = "en";

export const VALID_LOCALES = ["da", "de", "en", "es", "fr", "zh"];

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
