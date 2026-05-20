import { Dict, Scope } from "../typing";
import { I18n } from "../I18n";

/**
 * Get the full scope.
 *
 * @private
 *
 * @param {I18n} i18n The I18n instance.
 * @param {Scope} scope The scope object.
 * @param {object} options  Options containing the base scope to be prepended.
 * @returns {string} The full scope joined by the default separator.
 */
export function getFullScope(i18n: I18n, scope: Scope, options: Dict): string {
    let result = "";

    // Deal with string scopes.
    if (scope instanceof String || typeof scope === "string") {
        result = scope as string;
    }

    // Deal with the scope as an array.
    if (scope instanceof Array) {
        result = (scope as string[]).join(i18n.defaultSeparator);
    }

    // Deal with the scope option provided through the second argument.
    //
    //    I18n.t('hello', {scope: 'greetings'});
    //
    if (options.scope) {
        result = [options.scope, result].join(i18n.defaultSeparator);
    }

    return result;
}
