import { Dict, Scope, TranslateOptions } from "../typing";
import { I18n } from "../I18n";
import { isSet } from "./isSet";

/**
 * Generate a list of translation options for default fallback.
 * `defaultValue` is also deleted from options as it is returned as part of
 * the translationOptions array.
 *
 * @private
 *
 * @param {I18n} i18n The I18n instance.
 *
 * @param {string|array} scope The translation scope.
 *
 * @param {object} options The translation options.
 *
 * @returns {array} Translation options
 */
export function createTranslationOptions(
    i18n: I18n,
    scope: Scope,
    options: Dict,
): TranslateOptions[] {
    let translationOptions: Dict[] = [{ scope }];

    // Defaults should be an array of hashes containing either
    // fallback scopes or messages
    if (isSet(options.defaults)) {
        translationOptions = translationOptions.concat(options.defaults);
    }

    // Maintain support for defaultValue. Since it is always a message
    // insert it in to the translation options as such.
    if (isSet(options.defaultValue)) {
        const message =
      typeof options.defaultValue === "function"
          ? options.defaultValue(i18n, scope, options)
          : options.defaultValue;

        translationOptions.push({ message });
        delete options.defaultValue;
    }

    return translationOptions as unknown as TranslateOptions[];
}
