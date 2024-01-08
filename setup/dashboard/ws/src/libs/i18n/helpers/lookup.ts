import { Dict, Scope } from "../typing";
import { I18n } from "../I18n";
import { isSet } from "./isSet";
import { getFullScope } from "./getFullScope";
import { inferType } from "./inferType";

/**
 * Find and process the translation using the provided scope and options.
 * This is used internally by some functions and should not be used as a
 * public API.
 *
 * @private
 *
 * @param {I18n} i18n The I18n instance.
 *
 * @param {Scope} scope The translation scope.
 *
 * @param {Dict|undefined} options The lookup options.
 *
 * @returns {string} The resolved translation.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function lookup(i18n: I18n, scope: Scope, options: Dict = {}): any {
    options = { ...options };

    const locale = "locale" in options ? options.locale : i18n.locale;
    const localeType = inferType(locale);

    const locales = i18n.locales
        .get(localeType === "string" ? locale : typeof locale)
        .slice();

    const keys = getFullScope(i18n, scope, options)
        .split(i18n.defaultSeparator)
        .map((component) => i18n.transformKey(component));

    const entries = locales.map((locale) =>
        keys.reduce((path, key) => path && path[key], i18n.translations[locale]),
    );

    entries.push(options.defaultValue);

    return entries.find((entry) => isSet(entry));
}
