import { Dict, MissingTranslationStrategy, Scope } from "./typing";
import { getFullScope, inferType } from "./helpers";
import { I18n } from "./I18n";

/**
 * Generate a human readable version of the scope as the missing translation.
 * To use it, you have to set `i18n.missingBehavior` to `"guess"`.
 *
 * @type {MissingTranslationStrategy}
 *
 * @param {I18n} i18n The I18n instance.
 *
 * @param {Scope} scope The translation scope.
 *
 * @returns {string} The missing translation string.
 */
export const guessStrategy: MissingTranslationStrategy = function(
    i18n,
    scope,
) {
    if (scope instanceof Array) {
        scope = scope.join(i18n.defaultSeparator);
    }

    // Get only the last portion of the scope.
    const message = scope.split(i18n.defaultSeparator).slice(-1)[0];

    // Replace underscore with space and camelcase with space and
    // lowercase letter.
    return (
        i18n.missingTranslationPrefix +
    message
        .replace("_", " ")
        .replace(
            /([a-z])([A-Z])/g,
            (_match: string, p1: string, p2: string) => `${p1} ${p2.toLowerCase()}`,
        )
    );
};

/**
 * Generate the missing translation message, which includes the full scope.
 * To use it, you have to set `i18n.missingBehavior` to `"message"`.
 * This is the default behavior.
 *
 * @type {MissingTranslationStrategy}
 *
 * @param {I18n} i18n The I18n instance.
 *
 * @param {Scope} scope The translation scope.
 *
 * @param {Dict} options The translations' options.
 *
 * @returns {string} The missing translation string.
 */
export const messageStrategy: MissingTranslationStrategy = (
    i18n,
    scope,
    options,
) => {
    const fullScope = getFullScope(i18n, scope, options);
    const locale = "locale" in options ? options.locale : i18n.locale;
    const localeType = inferType(locale);

    const fullScopeWithLocale = [
        localeType === "string" ? locale : localeType,
        fullScope,
    ].join(i18n.defaultSeparator);

    return `[missing "${fullScopeWithLocale}" translation]`;
};

/**
 * Throw an error whenever a translation cannot be found. The message will
 * includes the full scope.
 * To use it, you have to set `i18n.missingBehavior` to `"error"`.
 *
 * @type {MissingTranslationStrategy}
 *
 * @param {I18n} i18n The I18n instance.
 *
 * @param {Scope} scope The translation scope.
 *
 * @param {Dict} options The translations' options.
 *
 * @returns {void}
 */
export const errorStrategy: MissingTranslationStrategy = (
    i18n,
    scope,
    options,
) => {
    const fullScope = getFullScope(i18n, scope, options);
    const fullScopeWithLocale = [i18n.locale, fullScope].join(
        i18n.defaultSeparator,
    );

    throw new Error(`Missing translation: ${fullScopeWithLocale}`);
};

export class MissingTranslation {
    private i18n: I18n;
    private registry: Dict;

    public constructor(i18n: I18n) {
        this.i18n = i18n;
        this.registry = {};

        this.register("guess", guessStrategy);
        this.register("message", messageStrategy);
        this.register("error", errorStrategy);
    }

    /**
   * Registers a new missing translation strategy. This is how messages are
   * defined when a translation cannot be found.
   *
   * The follow example registers a strategy that always return the phrase
   * "Oops! Missing translation.".
   *
   * @example
   * ```js
   * i18n.missingTranslation.register(
   *   "oops",
   *   (i18n, scope, options) => "Oops! Missing translation."
   * );
   *
   * i18n.missingBehavior = "oops";
   * ```
   *
   * @param {string} name The strategy name.
   *
   * @param {MissingTranslationStrategy} strategy A function that returns a
   * string the result of a missing translation scope.
   *
   * @returns {void}
   */
    public register(name: string, strategy: MissingTranslationStrategy): void {
        this.registry[name] = strategy;
    }

    /**
   * Return a missing translation message for the given parameters.
   *
   * @param {Scope} scope The translations' scope.
   *
   * @param {Dict} options The translations' options.
   *
   * @returns {string} The missing translation.
   */
    public get(scope: Scope, options: Dict): string {
        return this.registry[options.missingBehavior ?? this.i18n.missingBehavior](
            this.i18n,
            scope,
            options,
        );
    }
}
