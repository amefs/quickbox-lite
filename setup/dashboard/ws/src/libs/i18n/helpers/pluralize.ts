import { Scope, TranslateOptions } from "../typing";
import { I18n } from "../I18n";

import { isSet } from "./isSet";
import { lookup } from "./lookup";

/**
 * Pluralize the given scope using the `count` value.
 * The pluralized translation may have other placeholders,
 * which will be retrieved from `options`.
 *
 * @private
 *
 * @param {I18n} i18n The I18n instance.
 *
 * @param {number} count The counting number.
 *
 * @param {Scope} scope The translation scope.
 *
 * @param {object} options The translation options.
 *
 * @returns {string} The translated string.
 */
export function pluralize({
    i18n,
    count,
    scope,
    options,
    baseScope,
}: {
    i18n: I18n;
    count: number;
    scope: Scope;
    options: TranslateOptions;
    baseScope: string;
}): string {
    options = { ...options };
    let translations;
    let message;

    if (typeof scope === "object" && scope) {
        translations = scope;
    } else {
        translations = lookup(i18n, scope, options);
    }

    if (!translations) {
        return i18n.missingTranslation.get(scope, options);
    }

    const pluralizer = i18n.pluralization.get(options.locale);
    const keys = pluralizer(i18n, count);
    const missingKeys: typeof keys = [];

    while (keys.length) {
        const key = keys.shift() as string;

        if (isSet(translations[key])) {
            message = translations[key];
            break;
        }

        missingKeys.push(key);
    }

    if (!isSet(message)) {
        return i18n.missingTranslation.get(
            baseScope.split(i18n.defaultSeparator).concat([missingKeys[0]]),
            options,
        );
    }

    options.count = count;

    return i18n.interpolate(i18n, message, options);
}
