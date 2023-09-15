import { TranslateOptions } from "../typing";
import { I18n } from "../I18n";
import { isSet } from "./isSet";

/**
 * This function interpolates the all variables in the given message.
 *
 * @private
 *
 * @param {I18n} i18n The I18n instance.
 *
 * @param {string} message The string containing the placeholders.
 *
 * @param {object} options The source object that will be used as the
 * placeholders' source.
 *
 * @returns {string} The interpolated string.
 */
export function interpolate(
    i18n: I18n,
    message: string,
    options: TranslateOptions,
): string {
    options = Object.keys(options).reduce((buffer, key) => {
        buffer[i18n.transformKey(key)] = options[key];
        return buffer;
    }, {} as TranslateOptions);
    const matches = message.match(i18n.placeholder);

    if (!matches) {
        return message;
    }

    while (matches.length) {
        let value: string;
        const placeholder = matches.shift() as string;
        const name = placeholder.replace(i18n.placeholder, "$1");

        if (isSet(options[name])) {
            value = options[name].toString().replace(/\$/gm, "_#$#_");
        } else if (name in options) {
            value = i18n.nullPlaceholder(i18n, placeholder, message, options);
        } else {
            value = i18n.missingPlaceholder(i18n, placeholder, message, options);
        }

        const regex = new RegExp(
            placeholder.replace(/\{/gm, "\\{").replace(/\}/gm, "\\}"),
        );

        message = message.replace(regex, value);
    }

    return message.replace(/_#\$#_/g, "$");
}
