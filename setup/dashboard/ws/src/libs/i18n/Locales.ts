import { uniq } from "lodash";

import { Dict, LocaleResolver } from "./typing";
import { I18n } from "./I18n";

/**
 * The default locale resolver.
 *
 * This resolver will add `options.locale` if provided (this function receives
 * it inlined). In case nothing is set, then `i18n.locale` will be used.
 * Additionally, adds the default locale to the list if `i18n.enableFallback` is
 * set.
 *
 * Every locale added to the list will then be split apart; if `pt-BR` is the
 * locale, then the list will be returned as `["pt-BR", "pt"]`.
 *
 * The default in case nothing is defined is `["en"]`.
 *
 * @type {LocaleResolver}
 *
 * @param {I18n} i18n The I18n instance.
 *
 * @param {string} locale The locale that being analysed.
 *
 * @returns {string[]} The resolved locales.
 */
export const defaultLocaleResolver: LocaleResolver = (
    i18n: I18n,
    locale: string,
): string[] => {
    const locales = [];
    const list: string[] = [];

    // Handle the inline locale option that can be provided to
    // the `I18n.t` options.
    locales.push(locale);

    // Add the current locale to the list.
    if (!locale) {
        locales.push(i18n.locale);
    }

    // Add the default locale if fallback strategy is enabled.
    if (i18n.enableFallback) {
        locales.push(i18n.defaultLocale);
    }

    // Compute each locale with its country code.
    // So this will return an array containing both
    // `de-DE` and `de` locales.
    //
    // We also need to support locales with region code (e.g. zh-Hant-TW).
    // In that case, the list should be `["zh-hant-tw", "zh-hant", "zh"]`.
    locales
        .filter(Boolean)
        .map((entry) => entry.toString())
        .forEach(function(currentLocale: string) {
            if (!list.includes(currentLocale)) {
                list.push(currentLocale);
            }

            if (!i18n.enableFallback) {
                return;
            }

            const codes = currentLocale.split("-");

            if (codes.length === 3) {
                list.push(`${codes[0]}-${codes[1]}`);
            }

            list.push(codes[0]);
        });

    return uniq(list);
};

export class Locales {
    private i18n: I18n;
    private registry: Dict;

    public constructor(i18n: I18n) {
        this.i18n = i18n;
        this.registry = {};

        this.register("default", defaultLocaleResolver);
    }

    /**
   * You can define custom rules for any locale. Just make sure you return an
   * array containing all locales.
   *
   * ```js
   * // Default the Wookie locale to English.
   * i18n.locales.register("wk",  (_i18n, locale) => {
   *   return ["en"];
   * });
   * ```
   *
   * @param {string} locale The locale's name.
   *
   * @param {LocaleResolver|string|string[]} localeResolver The locale resolver
   * strategy.
   *
   * @returns {void}
   */
    public register(
        locale: string,
        localeResolver: LocaleResolver | string | string[],
    ): void {
        if (typeof localeResolver !== "function") {
            const result = localeResolver;
            localeResolver = (() => result) as LocaleResolver;
        }

        this.registry[locale] = localeResolver;
    }

    /**
   * Return a list of all locales that must be tried before returning the
   * missing translation message. By default, this will consider the inline
   * option, current locale and fallback locale.
   *
   * ```js
   * i18n.locales.get("de-DE");
   * // ["de-DE", "de", "en"]
   * ```
   *
   * @param {string} locale The locale query.
   *
   * @returns {string[]} The list of locales.
   */
    public get(locale: string): string[] {
        let locales =
      this.registry[locale] ||
      this.registry[this.i18n.locale] ||
      this.registry.default;

        if (typeof locales === "function") {
            locales = locales(this.i18n, locale);
        }

        if (!(locales instanceof Array)) {
            locales = [locales];
        }
        return locales;
    }
}
