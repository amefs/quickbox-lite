/* eslint-disable class-methods-use-this, no-underscore-dangle */

import { get, has, merge } from "lodash";

import {
    DateTime,
    Dict,
    FormatNumberOptions,
    I18nOptions,
    MissingPlaceholderHandler,
    NullPlaceholderHandler,
    NumberToCurrencyOptions,
    NumberToDelimitedOptions,
    NumberToHumanOptions,
    NumberToHumanSizeOptions,
    NumberToPercentageOptions,
    NumberToRoundedOptions,
    Numeric,
    OnChangeHandler,
    Scope,
    StrftimeOptions,
    TimeAgoInWordsOptions,
    ToSentenceOptions,
    TranslateOptions,
} from "./typing";
import { Locales } from "./Locales";
import { Pluralization } from "./Pluralization";
import { MissingTranslation } from "./MissingTranslation";
import {
    camelCaseKeys,
    createTranslationOptions,
    formatNumber,
    getFullScope,
    inferType,
    interpolate,
    isSet,
    lookup,
    numberToDelimited,
    numberToHuman,
    numberToHumanSize,
    parseDate,
    pluralize,
    strftime,
    timeAgoInWords,
} from "./helpers";

const DEFAULT_I18N_OPTIONS: I18nOptions = {
    defaultLocale: "en",
    availableLocales: ["en"],
    locale: "en",
    defaultSeparator: ".",
    placeholder: /(?:\{\{|%\{)(.*?)(?:\}\}?)/gm,
    enableFallback: false,
    missingBehavior: "message",
    missingTranslationPrefix: "",

    missingPlaceholder: (_i18n: I18n, placeholder: string): string =>
        `[missing "${placeholder}" value]`,

    nullPlaceholder: (
        i18n: I18n,
        placeholder,
        message: string,
        options: Dict,
    ): string => i18n.missingPlaceholder(i18n, placeholder, message, options),

    transformKey: (key: string): string => key,
};

export class I18n {
    /**
   * List of all onChange handlers.
   *
   * @type {OnChangeHandler[]}
   */
    public onChangeHandlers: OnChangeHandler[] = [];

    /**
   * Set the default string separator. Defaults to `.`, as in
   * `scope.translation`.
   *
   * @type {string}
   */
    public defaultSeparator: string;

    /**
   * Set if engine should fallback to the default locale when a translation is
   * missing. Defaults to `false`.
   *
   * When enabled, missing translations will first be looked for in less
   * specific versions of the requested locale and if that fails by taking them
   * from your `I18n#defaultLocale`.
   *
   * @type {boolean}
   */
    public enableFallback: boolean;

    /**
   * The locale resolver registry.
   *
   * @see {@link Locales}
   *
   * @type {Locales}
   */
    public locales: Locales;

    /**
   * The pluralization behavior registry.
   *
   * @see {@link Pluralization}
   *
   * @type {Pluralization}
   */
    public pluralization: Pluralization;

    /**
   * Set missing translation behavior.
   *
   * - `message` will display a message that the translation is missing.
   * - `guess` will try to guess the string.
   * - `error` will raise an exception whenever a translation is not defined.
   *
   * See {@link MissingTranslation.register} for instructions on how to define
   * your own behavior.
   *
   * @type {MissingBehavior}
   */
    public missingBehavior: string;

    /**
   * Return a missing placeholder message for given parameters.
   *
   * @type {MissingPlaceholderHandler}
   */
    public missingPlaceholder: MissingPlaceholderHandler;

    /**
   * If you use missingBehavior with 'message', but want to know that the string
   * is actually missing for testing purposes, you can prefix the guessed string
   * by setting the value here. By default, no prefix is used.
   *
   * @type {string}
   */
    public missingTranslationPrefix: string;

    /**
   * Return a placeholder message for null values. Defaults to the same behavior
   * as `I18n.missingPlaceholder`.
   *
   * @type {NullPlaceholderHandler}
   */
    public nullPlaceholder: NullPlaceholderHandler;

    /**
   * The missing translation behavior registry.
   *
   * @see {@link MissingTranslation}
   *
   * @type {MissingTranslation}
   */
    public missingTranslation: MissingTranslation;

    /**
   * Set the placeholder format. Accepts `{{placeholder}}` and `%{placeholder}`.
   *
   * @type {RegExp}
   */
    public placeholder: RegExp;

    /**
   * Set the registered translations. The root key must always be the locale
   * (and its variations with region).
   *
   * Remember that no events will be triggered if you change this object
   * directly. To trigger `onchange` events, you must perform updates either
   * using `I18n#store` or `I18n#update`.
   *
   * @type {Dict}
   */
    public translations: Dict = {};

    /**
   * Transform keys. By default, it returns the key as it is, but allows for
   * overriding. For instance, you can set a function to receive the camelcase
   * key, and convert it to snake case.
   *
   * @type {(key: string) => string}
   */
    public transformKey: (key: string) => string;

    /**
   * Override the interpolation function. For the default implementation, see
   * <https://github.com/fnando/i18n/tree/main/src/helpers/interpolate.ts>
   * @type {(i18n: I18n, message: string, options: TranslateOptions) => string}
   */
    public interpolate: typeof interpolate;

    /**
   * Set the available locales.
   *
   * @type {string[]}
   */
    public availableLocales: string[] = [];


    /**
   * @alias {@link translate}
   */
    public t = this.translate.bind(this);

    /**
   * @alias {@link pluralize}
   */
    public p = this.pluralize.bind(this);

    /**
       * @alias {@link localize}
       */
    public l = this.localize.bind(this);

    /**
       * @alias {@link timeAgoInWords}
       */
    public distanceOfTimeInWords = this.timeAgoInWords.bind(this);

    private _locale: string = DEFAULT_I18N_OPTIONS.locale;
    private _defaultLocale: string = DEFAULT_I18N_OPTIONS.defaultLocale;
    private _version = 0;

    public constructor(translations: Dict = {}, options: Partial<I18nOptions> = {}) {
        const {
            locale,
            enableFallback,
            missingBehavior,
            missingTranslationPrefix,
            missingPlaceholder,
            nullPlaceholder,
            defaultLocale,
            defaultSeparator,
            placeholder,
            transformKey,
        }: I18nOptions = {
            ...DEFAULT_I18N_OPTIONS,
            ...options,
        };

        this.locale = locale;
        this.defaultLocale = defaultLocale;
        this.defaultSeparator = defaultSeparator;
        this.enableFallback = enableFallback;
        this.locale = locale;
        this.missingBehavior = missingBehavior;
        this.missingTranslationPrefix = missingTranslationPrefix;
        this.missingPlaceholder = missingPlaceholder;
        this.nullPlaceholder = nullPlaceholder;
        this.placeholder = placeholder;
        this.pluralization = new Pluralization(this);
        this.locales = new Locales(this);
        this.missingTranslation = new MissingTranslation(this);
        this.transformKey = transformKey;
        this.interpolate = interpolate;

        this.store(translations);
    }

    /**
   * Return the current locale, using a explicit locale set using
   * `i18n.locale = newLocale`, the default locale set using
   * `i18n.defaultLocale` or the fallback, which is `en`.
   *
   * @returns {string} The current locale.
   */
    public get locale(): string {
        return this._locale || this.defaultLocale || "en";
    }

    /**
     * Return the default locale, using a explicit locale set using
     * `i18n.defaultLocale = locale`, the default locale set using
     * `i18n.defaultLocale` or the fallback, which is `en`.
     *
     * @returns {string} The current locale.
     */
    public get defaultLocale(): string {
        return this._defaultLocale || "en";
    }

    /**
           * Return the change version. This value is incremented whenever `I18n#store`
           * or `I18n#update` is called, or when `I18n#locale`/`I18n#defaultLocale` is
           * set.
           */
    public get version(): number {
        return this._version;
    }

    /**
 * Set the current locale explicitly.
 *
 * @param {string} newLocale The new locale.
 */
    public set locale(newLocale: string) {
        if (typeof newLocale !== "string") {
            throw new Error(
                `Expected newLocale to be a string; got ${inferType(newLocale)}`,
            );
        }

        const changed = this._locale !== newLocale;

        this._locale = newLocale;

        if (changed) {
            this.hasChanged();
        }
    }

    /**
     * Set the default locale explicitly.
     *
     * @param {string} newLocale The new locale.
     */
    public set defaultLocale(newLocale: string) {
        if (typeof newLocale !== "string") {
            throw new Error(
                `Expected newLocale to be a string; got ${inferType(newLocale)}`,
            );
        }

        const changed = this._defaultLocale !== newLocale;

        this._defaultLocale = newLocale;

        if (changed) {
            this.hasChanged();
        }
    }

    /**
   * Update translations by merging them. Newest translations will override
   * existing ones.
   *
   * @param {Dict} translations An object containing the translations that will
   * be merged into existing translations.
   *
   * @returns {void}
   */
    public store(translations: Dict): void {
        merge(this.translations, translations);
        this.hasChanged();
    }

    /**
   * Translate the given scope with the provided options.
   *
   * @param {string|array} scope The scope that will be used.
   *
   * @param {TranslateOptions} options The options that will be used on the
   * translation. Can include some special options like `defaultValue`, `count`,
   * and `scope`. Everything else will be treated as replacement values.
   *
   * @param {number} options.count Enable pluralization. The returned
   * translation will depend on the detected pluralizer.
   *
   * @param {any} options.defaultValue The default value that will used in case
   * the translation defined by `scope` cannot be found. Can be a function that
   * returns a string; the signature is
   * `(i18n:I18n, options: TranslateOptions): string`.
   *
   * @param {MissingBehavior|string} options.missingBehavior The missing
   * behavior that will be used instead of the default one.
   *
   * @param {Dict[]} options.defaults  An array of hashs where the key is the
   * type of translation desired, a `scope` or a `message`. The translation
   * returned will be either the first scope recognized, or the first message
   * defined.
   *
   * @returns {T | string} The translated string.
   */
    public translate<T = string>(
        scope: Scope,
        options?: TranslateOptions,
    ): string | T {
        options = { ...options };

        const translationOptions: TranslateOptions[] = createTranslationOptions(
            this,
            scope,
            options,
        ) as TranslateOptions[];

        let translation: string | Dict | undefined;

        // Iterate through the translation options until a translation
        // or message is found.
        const hasFoundTranslation = translationOptions.some(
            (translationOption: TranslateOptions) => {
                if (isSet(translationOption.scope)) {
                    translation = lookup(this, translationOption.scope as Scope, options);
                } else if (isSet(translationOption.message)) {
                    translation = translationOption.message;
                }

                return translation !== undefined && translation !== null;
            },
        );

        if (!hasFoundTranslation) {
            return this.missingTranslation.get(scope, options);
        }

        if (typeof translation === "string") {
            translation = this.interpolate(this, translation, options);
        } else if (
            typeof translation === "object" &&
      translation &&
      isSet(options.count)
        ) {
            translation = pluralize({
                i18n: this,
                count: options.count || 0,
                scope: translation as unknown as string,
                options,
                baseScope: getFullScope(this, scope, options),
            });
        }

        if (options && translation instanceof Array) {
            translation = translation.map((entry) =>
                typeof entry === "string"
                    ? interpolate(this, entry, options as TranslateOptions)
                    : entry,
            );
        }

        return translation as string | T;
    }

    /**
   * Pluralize the given scope using the `count` value. The pluralized
   * translation may have other placeholders, which will be retrieved from
   * `options`.
   *
   * @param {number} count The counting number.
   *
   * @param {Scope} scope The translation scope.
   *
   * @param {TranslateOptions} options The translation options.
   *
   * @returns {string} The translated string.
   */
    public pluralize(
        count: number,
        scope: Scope,
        options?: TranslateOptions,
    ): string {
        return pluralize({
            i18n: this,
            count,
            scope,
            options: { ...options },
            baseScope: getFullScope(this, scope, options ?? {}),
        });
    }

    /**
   * Localize several values.
   *
   * You can provide the following scopes: `currency`, `number`, or
   * `percentage`. If you provide a scope that matches the `/^(date|time)/`
   * regular expression then the `value` will be converted by using the
   * `I18n.toTime` function. It will default to the value's `toString` function.
   *
   * If value is either `null` or `undefined` then an empty string will be
   * returned, regardless of what localization type has been used.
   *
   * @param {string} type The localization type.
   *
   * @param {string|number|Date} value The value that must be localized.
   *
   * @param {Dict} options The localization options.
   *
   * @returns {string} The localized string.
   */
    public localize(
        type: string,
        value: string | number | Date | null | undefined,
        options?: Dict,
    ): string {
        options = { ...options };

        if (value === undefined || value === null) {
            return "";
        }

        switch (type) {
            case "currency":
                return this.numberToCurrency(value as number);

            case "number":
                return formatNumber(value as number, {
                    delimiter: ",",
                    precision: 3,
                    separator: ".",
                    significant: false,
                    stripInsignificantZeros: false,
                    ...lookup(this, "number.format"),
                });

            case "percentage":
                return this.numberToPercentage(value as number);

            default: {
                let localizedValue: string;

                if (type.match(/^(date|time)/)) {
                    localizedValue = this.toTime(type, value as DateTime);
                } else {
                    localizedValue = (value as string | number | Date).toString();
                }

                return interpolate(this, localizedValue, options);
            }
        }
    }


    /**
   * Convert the given dateString into a formatted date.
   *
   * @param {scope} scope The formatting scope.
   *
   * @param {DateTime} input The string that must be parsed into a Date object.
   *
   * @returns {string} The formatted date.
   */
    public toTime(scope: Scope, input: DateTime): string {
        const date = parseDate(input);
        const format: string = lookup(this, scope);

        if (date.toString().match(/invalid/i)) {
            return date.toString();
        }

        if (!format) {
            return date.toString();
        }

        return this.strftime(date, format);
    }

    /**
   * Formats a `number` into a currency string (e.g., $13.65). You can customize
   * the format in the using an `options` object.
   *
   * The currency unit and number formatting of the current locale will be used
   * unless otherwise specified in the provided options. No currency conversion
   * is performed. If the user is given a way to change their locale, they will
   * also be able to change the relative value of the currency displayed with
   * this helper.
   *
   * @example
   * ```js
   * i18n.numberToCurrency(1234567890.5);
   * // => "$1,234,567,890.50"
   *
   * i18n.numberToCurrency(1234567890.506);
   * // => "$1,234,567,890.51"
   *
   * i18n.numberToCurrency(1234567890.506, { precision: 3 });
   * // => "$1,234,567,890.506"
   *
   * i18n.numberToCurrency("123a456");
   * // => "$123a456"
   *
   * i18n.numberToCurrency("123a456", { raise: true });
   * // => raises exception ("123a456" is not a valid numeric value)
   *
   * i18n.numberToCurrency(-0.456789, { precision: 0 });
   * // => "$0"
   *
   * i18n.numberToCurrency(-1234567890.5, { negativeFormat: "(%u%n)" });
   * // => "($1,234,567,890.50)"
   *
   * i18n.numberToCurrency(1234567890.5, {
   *   unit: "&pound;",
   *   separator: ",",
   *   delimiter: "",
   * });
   * // => "&pound;1234567890,50"
   *
   * i18n.numberToCurrency(1234567890.5, {
   *   unit: "&pound;",
   *   separator: ",",
   *   delimiter: "",
   *   format: "%n %u",
   * });
   * // => "1234567890,50 &pound;"
   *
   * i18n.numberToCurrency(1234567890.5, { stripInsignificantZeros: true });
   * // => "$1,234,567,890.5"
   *
   * i18n.numberToCurrency(1234567890.5, { precision: 0, roundMode: "up" });
   * // => "$1,234,567,891"
   * ```
   *
   * @param {Numeric} input  The number to be formatted.
   *
   * @param {NumberToCurrencyOptions} options The formatting options. When
   * defined, supersedes the default options defined by `number.format` and
   * `number.currency.*`.
   *
   * @param {number} options.precision Sets the level of precision (defaults to
   * 2).
   *
   * @param {RoundingMode} options.roundMode Determine how rounding is performed
   * (defaults to `default`.)
   *
   * @param {string} options.unit Sets the denomination of the currency
   * (defaults to "$").
   *
   * @param {string} options.separator Sets the separator between the units
   * (defaults to ".").
   *
   * @param {string} options.delimiter Sets the thousands delimiter
   * (defaults to ",").
   *
   * @param {string} options.format Sets the format for non-negative numbers
   * (defaults to "%u%n"). Fields are `%u` for the currency, and `%n` for the
   * number.
   *
   * @param {string} options.negativeFormat Sets the format for negative numbers
   * (defaults to prepending a hyphen to the formatted number given by
   * `format`). Accepts the same fields than `format`, except `%n` is here the
   * absolute value of the number.
   *
   * @param {boolean} options.stripInsignificantZeros If `true` removes
   * insignificant zeros after the decimal separator (defaults to `false`).
   *
   * @param {boolean} options.raise If `true`, raises exception for non-numeric
   * values like `NaN` and infinite values.
   *
   * @returns {string} The formatted number.
   */
    public numberToCurrency(
        input: Numeric,
        options: Partial<NumberToCurrencyOptions> = {},
    ): string {
        return formatNumber(input, {
            delimiter: ",",
            format: "%u%n",
            precision: 2,
            separator: ".",
            significant: false,
            stripInsignificantZeros: false,
            unit: "$",
            ...camelCaseKeys<Partial<FormatNumberOptions>>(this.get("number.format")),
            ...camelCaseKeys<Partial<NumberToCurrencyOptions>>(
                this.get("number.currency.format"),
            ),
            ...options,
        } as FormatNumberOptions);
    }

    /**
   * Convert a number into a formatted percentage value.
   *
   * @example
   * ```js
   * i18n.numberToPercentage(100);
   * // => "100.000%"
   *
   * i18n.numberToPercentage("98");
   * // => "98.000%"
   *
   * i18n.numberToPercentage(100, { precision: 0 });
   * // => "100%"
   *
   * i18n.numberToPercentage(1000, { delimiter: ".", separator: "," });
   * // => "1.000,000%"
   *
   * i18n.numberToPercentage(302.24398923423, { precision: 5 });
   * // => "302.24399%"
   *
   * i18n.numberToPercentage(1000, { precision: null });
   * // => "1000%"
   *
   * i18n.numberToPercentage("98a");
   * // => "98a%"
   *
   * i18n.numberToPercentage(100, { format: "%n  %" });
   * // => "100.000  %"
   *
   * i18n.numberToPercentage(302.24398923423, { precision: 5, roundMode: "down" });
   * // => "302.24398%"
   * ```
   *
   * @param {Numeric} input The number to be formatted.
   *
   * @param {NumberToPercentageOptions} options The formatting options. When
   * defined, supersedes the default options stored at `number.format` and
   * `number.percentage.*`.
   *
   * @param {number} options.precision Sets the level of precision (defaults to
   * 3).
   *
   * @param {RoundingMode} options.roundMode Determine how rounding is performed
   * (defaults to `default`.)
   *
   * @param {string} options.separator Sets the separator between the units
   * (defaults to ".").
   *
   * @param {string} options.delimiter Sets the thousands delimiter (defaults to
   * "").
   *
   * @param {string} options.format Sets the format for non-negative numbers
   * (defaults to "%n%"). The number field is represented by `%n`.
   *
   * @param {string} options.negativeFormat Sets the format for negative numbers
   * (defaults to prepending a hyphen to the formatted number given by
   * `format`). Accepts the same fields than `format`, except `%n` is here the
   * absolute value of the number.
   *
   * @param {boolean} options.stripInsignificantZeros If `true` removes
   * insignificant zeros after the decimal separator (defaults to `false`).
   *
   * @returns {string} The formatted number.
   */
    public numberToPercentage(
        input: Numeric,
        options: Partial<NumberToPercentageOptions> = {},
    ): string {
        return formatNumber(input, {
            delimiter: "",
            format: "%n%",
            precision: 3,
            stripInsignificantZeros: false,
            separator: ".",
            significant: false,
            ...camelCaseKeys<Partial<FormatNumberOptions>>(this.get("number.format")),
            ...camelCaseKeys<Partial<NumberToPercentageOptions>>(
                this.get("number.percentage.format"),
            ),
            ...options,
        } as FormatNumberOptions);
    }

    /**
   * Convert a number into a readable size representation.
   *
   * @example
   * ```js
   * i18n.numberToHumanSize(123)
   * // => "123 Bytes"
   *
   * i18n.numberToHumanSize(1234)
   * // => "1.21 KB"
   *
   * i18n.numberToHumanSize(12345)
   * // => "12.1 KB"
   *
   * i18n.numberToHumanSize(1234567)
   * // => "1.18 MB"
   *
   * i18n.numberToHumanSize(1234567890)
   * // => "1.15 GB"
   *
   * i18n.numberToHumanSize(1234567890123)
   * // => "1.12 TB"
   *
   * i18n.numberToHumanSize(1234567890123456)
   * // => "1.1 PB"
   *
   * i18n.numberToHumanSize(1234567890123456789)
   * // => "1.07 EB"
   *
   * i18n.numberToHumanSize(1234567, {precision: 2})
   * // => "1.2 MB"
   *
   * i18n.numberToHumanSize(483989, precision: 2)
   * // => "470 KB"
   *
   * i18n.numberToHumanSize(483989, {precision: 2, roundMode: "up"})
   * // => "480 KB"
   *
   * i18n.numberToHumanSize(1234567, {precision: 2, separator: ","})
   * // => "1,2 MB"
   *
   * i18n.numberToHumanSize(1234567890123, {precision: 5})
   * // => "1.1228 TB"
   *
   * i18n.numberToHumanSize(524288000, {precision: 5})
   * // => "500 MB"
   * ```
   *
   * @param {Numeric} input The number that will be formatted.
   *
   * @param {NumberToHumanSizeOptions} options The formatting options. When
   * defined, supersedes the default options stored at
   * `number.human.storage_units.*` and `number.human.format`.
   *
   * @param {number} options.precision Sets the precision of the number
   * (defaults to 3).
   *
   * @param {RoundingMode} options.roundMode Determine how rounding is performed
   * (defaults to `default`)
   *
   * @param {boolean} options.significant If `true`, precision will be the
   * number of significant digits. If `false`, the number of fractional digits
   * (defaults to `true`).
   *
   * @param {string} options.separator Sets the separator between the fractional
   * and integer digits (defaults to ".").
   *
   * @param {string} options.delimiter Sets the thousands delimiter (defaults
   * to "").
   *
   * @param {boolean} options.stripInsignificantZeros If `true` removes
   * insignificant zeros after the decimal separator (defaults to `true`).
   *
   * @returns {string} The formatted number.
   */
    public numberToHumanSize(
        input: Numeric,
        options: Partial<NumberToHumanSizeOptions> = {},
    ): string {
        return numberToHumanSize(this, input, {
            delimiter: "",
            precision: 3,
            significant: true,
            stripInsignificantZeros: true,
            units: {
                billion: "Billion",
                million: "Million",
                quadrillion: "Quadrillion",
                thousand: "Thousand",
                trillion: "Trillion",
                unit: "",
            },
            ...camelCaseKeys<Partial<NumberToHumanSizeOptions>>(
                this.get("number.human.format"),
            ),
            ...camelCaseKeys<Partial<NumberToHumanSizeOptions>>(
                this.get("number.human.storage_units"),
            ),
            ...options,
        } as NumberToHumanSizeOptions);
    }

    /**
   * Convert a number into a readable representation.
   *
   * @example
   * ```js
   * i18n.numberToHuman(123);
   * // => "123"
   *
   * i18n.numberToHuman(1234);
   * // => "1.23 Thousand"
   *
   * i18n.numberToHuman(12345);
   * // => "12.3 Thousand"
   *
   * i18n.numberToHuman(1234567);
   * // => "1.23 Million"
   *
   * i18n.numberToHuman(1234567890);
   * // => "1.23 Billion"
   *
   * i18n.numberToHuman(1234567890123);
   * // => "1.23 Trillion"
   *
   * i18n.numberToHuman(1234567890123456);
   * // => "1.23 Quadrillion"
   *
   * i18n.numberToHuman(1234567890123456789);
   * // => "1230 Quadrillion"
   *
   * i18n.numberToHuman(489939, { precision: 2 });
   * // => "490 Thousand"
   *
   * i18n.numberToHuman(489939, { precision: 4 });
   * // => "489.9 Thousand"
   *
   * i18n.numberToHuman(489939, { precision: 2, roundMode: "down" });
   * // => "480 Thousand"
   *
   * i18n.numberToHuman(1234567, { precision: 4, significant: false });
   * // => "1.2346 Million"
   *
   * i18n.numberToHuman(1234567, {
   *   precision: 1,
   *   separator: ",",
   *   significant: false,
   * });
   * // => "1,2 Million"
   *
   * i18n.numberToHuman(500000000, { precision: 5 });
   * // => "500 Million"
   *
   * i18n.numberToHuman(12345012345, { significant: false });
   * // => "12.345 Billion"
   * ```
   *
   * Non-significant zeros after the decimal separator are stripped out by default
   * (set `stripInsignificantZeros` to `false` to change that):
   *
   * ```js
   * i18n.numberToHuman(12.00001);
   * // => "12"
   *
   * i18n.numberToHuman(12.00001, { stripInsignificantZeros: false });
   * // => "12.0"
   * ```
   *
   * You can also use your own custom unit quantifiers:
   *
   * ```js
   * i18n.numberToHuman(500000, units: { unit: "ml", thousand: "lt" });
   * // => "500 lt"
   * ```
   *
   * If in your I18n locale you have:
   *
   * ```yaml
   * ---
   * en:
   *   distance:
   *     centi:
   *       one: "centimeter"
   *       other: "centimeters"
   *     unit:
   *       one: "meter"
   *       other: "meters"
   *     thousand:
   *       one: "kilometer"
   *       other: "kilometers"
   *     billion: "gazillion-distance"
   * ```
   *
   * Then you could do:
   *
   * ```js
   * i18n.numberToHuman(543934, { units: "distance" });
   * // => "544 kilometers"
   *
   * i18n.numberToHuman(54393498, { units: "distance" });
   * // => "54400 kilometers"
   *
   * i18n.numberToHuman(54393498000, { units: "distance" });
   * // => "54.4 gazillion-distance"
   *
   * i18n.numberToHuman(343, { units: "distance", precision: 1 });
   * // => "300 meters"
   *
   * i18n.numberToHuman(1, { units: "distance" });
   * // => "1 meter"
   *
   * i18n.numberToHuman(0.34, { units: "distance" });
   * // => "34 centimeters"
   * ```
   *
   * @param  {Numeric} input The number that will be formatted.
   *
   * @param  {NumberToHumanOptions} options The formatting options. When
   * defined, supersedes the default options stored at `number.human.format.*`
   * and `number.human.storage_units.*`.
   *
   * @param {number} options.precision Sets the precision of the number
   * (defaults to 3).
   *
   * @param {RoundingMode} options.roundMode Determine how rounding is performed
   * (defaults to `default`).
   *
   * @param {boolean} options.significant If `true`, precision will be the
   * number of significant_digits. If `false`, the number of fractional digits
   * (defaults to `true`)
   *
   * @param {string} options.separator Sets the separator between the fractional
   * and integer digits (defaults to ".").
   *
   * @param {string} options.delimiter Sets the thousands delimiter
   * (defaults to "").
   *
   * @param {boolean} options.stripInsignificantZeros If `true` removes
   * insignificant zeros after the decimal separator (defaults to `true`).
   *
   * @param {Dict} options.units A Hash of unit quantifier names. Or a string
   * containing an I18n scope where to find this object. It might have the
   * following keys:
   *
   * - _integers_: `unit`, `ten`, `hundred`, `thousand`, `million`, `billion`,
   *   `trillion`, `quadrillion`
   * - _fractionals_: `deci`, `centi`, `mili`, `micro`, `nano`, `pico`, `femto`
   *
   * @param {string} options.format Sets the format of the output string
   * (defaults to "%n %u"). The field types are:
   *
   * - `%u` - The quantifier (ex.: 'thousand')
   * - `%n` - The number
   *
   * @returns {string} The formatted number.
   */
    public numberToHuman(
        input: Numeric,
        options: Partial<NumberToHumanOptions> = {},
    ): string {
        return numberToHuman(this, input, {
            delimiter: "",
            separator: ".",
            precision: 3,
            significant: true,
            stripInsignificantZeros: true,
            format: "%n %u",
            roundMode: "default",
            units: {
                billion: "Billion",
                million: "Million",
                quadrillion: "Quadrillion",
                thousand: "Thousand",
                trillion: "Trillion",
                unit: "",
            },
            ...camelCaseKeys<Partial<NumberToHumanOptions>>(
                this.get("number.human.format"),
            ),
            ...camelCaseKeys<Partial<NumberToHumanOptions>>(
                this.get("number.human.decimal_units"),
            ),
            ...options,
        } as NumberToHumanOptions);
    }

    /**
   * Convert number to a formatted rounded value.
   *
   * @example
   * ```js
   * i18n.numberToRounded(111.2345);
   * // => "111.235"
   *
   * i18n.numberToRounded(111.2345, { precision: 2 });
   * // => "111.23"
   *
   * i18n.numberToRounded(13, { precision: 5 });
   * // => "13.00000"
   *
   * i18n.numberToRounded(389.32314, { precision: 0 });
   * // => "389"
   *
   * i18n.numberToRounded(111.2345, { significant: true });
   * // => "111"
   *
   * i18n.numberToRounded(111.2345, { precision: 1, significant: true });
   * // => "100"
   *
   * i18n.numberToRounded(13, { precision: 5, significant: true });
   * // => "13.000"
   *
   * i18n.numberToRounded(13, { precision: null });
   * // => "13"
   *
   * i18n.numberToRounded(389.32314, { precision: 0, roundMode: "up" });
   * // => "390"
   *
   * i18n.numberToRounded(13, {
   *   precision: 5,
   *   significant: true,
   *   stripInsignificantZeros: true,
   * });
   * // => "13"
   *
   * i18n.numberToRounded(389.32314, { precision: 4, significant: true });
   * // => "389.3"
   *
   * i18n.numberToRounded(1111.2345, {
   *   precision: 2,
   *   separator: ",",
   *   delimiter: ".",
   * });
   * // => "1.111,23"
   * ```
   *
   * @param {Numeric} input The number to be formatted.
   *
   * @param {NumberToRoundedOptions} options The formatting options.
   *
   * @param {number} options.precision  Sets the precision of the number
   * (defaults to 3).
   *
   * @param {string} options.separator  Sets the separator between the
   * fractional and integer digits (defaults to ".").
   *
   * @param {RoundingMode} options.roundMode  Determine how rounding is
   * performed.
   *
   * @param {boolean} options.significant  If `true`, precision will be the
   * number of significant_digits. If `false`, the number of fractional digits
   * (defaults to `false`).
   *
   * @param {boolean} options.stripInsignificantZeros If `true` removes
   * insignificant zeros after the decimal separator (defaults to `false`).
   *
   * @returns {string} The formatted number.
   */
    public numberToRounded(
        input: Numeric,
        options?: Partial<NumberToRoundedOptions>,
    ): string {
        return formatNumber(input, {
            unit: "",
            precision: 3,
            significant: false,
            separator: ".",
            delimiter: "",
            stripInsignificantZeros: false,
            ...options,
        } as FormatNumberOptions);
    }

    /**
   * Formats a +number+ with grouped thousands using `delimiter` (e.g., 12,324).
   * You can customize the format in the `options` parameter.
   *
   * @example
   * ```js
   * i18n.numberToDelimited(12345678);
   * // => "12,345,678"
   *
   * i18n.numberToDelimited("123456");
   * // => "123,456"
   *
   * i18n.numberToDelimited(12345678.05);
   * // => "12,345,678.05"
   *
   * i18n.numberToDelimited(12345678, { delimiter: "." });
   * // => "12.345.678"
   *
   * i18n.numberToDelimited(12345678, { delimiter: "," });
   * // => "12,345,678"
   *
   * i18n.numberToDelimited(12345678.05, { separator: " " });
   * // => "12,345,678 05"
   *
   * i18n.numberToDelimited("112a");
   * // => "112a"
   *
   * i18n.numberToDelimited(98765432.98, { delimiter: " ", separator: "," });
   * // => "98 765 432,98"
   *
   * i18n.numberToDelimited("123456.78", {
   *   delimiterPattern: /(\d+?)(?=(\d\d)+(\d)(?!\d))/g,
   * });
   * // => "1,23,456.78"
   * ```
   *
   * @param {Numeric} input The numeric value that will be formatted.
   *
   * @param {NumberToDelimitedOptions} options The formatting options.
   *
   * @param {string} options.delimiter Sets the thousands delimiter (defaults to
   * ",").
   *
   * @param {string} options.separator Sets the separator between the fractional
   * and integer digits (defaults to ".").
   *
   * @param {RegExp} options.delimiterPattern Sets a custom regular expression
   * used for deriving the placement of delimiter. Helpful when using currency
   * formats like INR.
   *
   * @return {string} The formatted number.
   */
    public numberToDelimited(
        input: Numeric,
        options: Partial<NumberToDelimitedOptions> = {},
    ): string {
        return numberToDelimited(input, {
            delimiterPattern: /(\d)(?=(\d\d\d)+(?!\d))/g,
            delimiter: ",",
            separator: ".",
            ...options,
        } as NumberToDelimitedOptions);
    }

    /**
   * Executes function with given locale set. The locale will be changed only
   * during the `callback`'s execution, switching back to the previous value
   * once it finishes (with or without errors).
   *
   * This is an asynchronous call, which means you must use `await` or you may
   * end up with a race condition.
   *
   * @example
   * ```js
   * await i18n.withLocale("pt", () => {
   *   console.log(i18n.t("hello"));
   * });
   * ```
   *
   * @param {string} locale The temporary locale that will be set during the
   * function's execution.
   *
   * @param {Function} callback The function that will be executed with a
   * temporary locale set.
   *
   * @returns {void}
   */
    public async withLocale(locale: string, callback: () => void): Promise<void> {
        const originalLocale = this.locale;

        try {
            this.locale = locale;
            await callback();
        } finally {
            this.locale = originalLocale;
        }
    }

    /**
   * Formats time according to the directives in the given format string.
   * The directives begins with a percent (`%`) character. Any text not listed
   * as a directive will be passed through to the output string.
   *
   * @see strftime
   *
   * @param {Date} date The date that will be formatted.
   *
   * @param {string} format The formatting string.
   *
   * @param {StrftimeOptions} options The formatting options.
   *
   * @returns {string}        The formatted date.
   */
    public strftime(
        date: Date,
        format: string,
        options: Partial<StrftimeOptions> = {},
    ): string {
        return strftime(date, format, {
            ...camelCaseKeys(lookup(this, "date")),
            meridian: {
                am: lookup(this, "time.am") || "AM",
                pm: lookup(this, "time.pm") || "PM",
            },
            ...options,
        });
    }

    /**
   * You may want to update a part of your translations. This is a public
   * interface for doing it so.
   *
   * If the provided path exists, it'll be replaced. Otherwise, a new node will
   * be created. When running in strict mode, paths that doesn't already exist
   * will raise an exception.
   *
   * Strict mode will also raise an exception if the override type differs from
   * previous node type.
   *
   * @example
   * ```js
   * i18n.update("en.number.format", {unit: "%n %u"});
   * i18n.update("en.number.format", {unit: "%n %u"}, true);
   * ```
   *
   * @param {string} path The path that's going to be updated. It must
   * include the language, as in `en.messages`.
   *
   * @param {Dict} override The new translation node.
   *
   * @param {boolean} options Set options.
   *
   * @param {boolean} options.strict Raise an exception if path doesn't already
   * exist, or if previous node's type differs from new node's type.
   *
   * @returns {void}
   */
    public update(
        path: string,
        // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types, @typescript-eslint/no-explicit-any
        override: any,
        options: { strict: boolean } = { strict: false },
    ): void {
        if (options.strict && !has(this.translations, path)) {
            throw new Error(`The path "${path}" is not currently defined`);
        }

        const currentNode = get(this.translations, path);
        const currentType = inferType(currentNode);
        const overrideType = inferType(override);

        if (options.strict && currentType !== overrideType) {
            throw new Error(
                `The current type for "${path}" is "${currentType}", but you're trying to override it with "${overrideType}"`,
            );
        }

        let newNode: unknown;

        if (overrideType === "object") {
            newNode = { ...currentNode, ...override };
        } else {
            newNode = override;
        }

        const components = path.split(this.defaultSeparator);
        const prop = components.pop();
        let buffer = this.translations;

        for (const component of components) {
            if (!buffer[component]) {
                buffer[component] = {};
            }

            buffer = buffer[component];
        }

        buffer[prop as keyof typeof buffer] = newNode;

        this.hasChanged();
    }

    /**
   * Converts the array to a comma-separated sentence where the last element is
   * joined by the connector word.
   *
   * @example
   * ```js
   * i18n.toSentence(["apple", "banana", "pineapple"]);
   * //=> apple, banana, and pineapple.
   * ```
   *
   * @param {any[]} items The list of items that will be joined.
   *
   * @param {ToSentenceOptions} options The options.
   *
   * @param {string} options.wordsConnector The sign or word used to join the
   * elements in arrays with two or more elements (default: ", ").
   *
   * @param {string} options.twoWordsConnector The sign or word used to join the
   * elements in arrays with two elements (default: " and ").
   *
   * @param {string} options.lastWordConnector The sign or word used to join the
   * last element in arrays with three or more elements (default: ", and ").
   *
   * @returns {string} The joined string.
   */
    public toSentence(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        items: any[],
        options: Partial<ToSentenceOptions> = {},
    ): string {
        const { wordsConnector, twoWordsConnector, lastWordConnector } = {
            wordsConnector: ", ",
            twoWordsConnector: " and ",
            lastWordConnector: ", and ",
            ...camelCaseKeys<Partial<ToSentenceOptions>>(
                lookup(this, "support.array"),
            ),
            ...options,
        } as ToSentenceOptions;

        const size = items.length;

        switch (size) {
            case 0:
                return "";

            case 1:
                return `${items[0]}`;

            case 2:
                return items.join(twoWordsConnector);

            default:
                return [
                    items.slice(0, size - 1).join(wordsConnector),
                    lastWordConnector,
                    items[size - 1],
                ].join("");
        }
    }

    /**
   * Reports the approximate distance in time between two time representations.
   *
   * @param {DateTime} fromTime The initial time.
   *
   * @param {DateTime} toTime The ending time. Defaults to `Date.now()`.
   *
   * @param {TimeAgoInWordsOptions} options The options.
   *
   * @param {boolean} options.includeSeconds Pass `{includeSeconds: true}` if
   * you want more detailed approximations when distance < 1 min, 29 secs.
   *
   * @param {Scope} options.scope With the scope option, you can define a custom
   * scope to look up the translation.
   *
   * @returns {string} The distance in time representation.
   */
    public timeAgoInWords(
        fromTime: DateTime,
        toTime: DateTime,
        options: TimeAgoInWordsOptions = {},
    ): string {
        return timeAgoInWords(this, fromTime, toTime, options);
    }

    /**
   * Add a callback that will be executed whenever locale/defaultLocale changes,
   * or `I18n#store` / `I18n#update` is called.
   *
   * @param {OnChangeHandler} callback The callback that will be executed.
   *
   * @returns {Function} Return a function that can be used to unsubscribe the
   *                     event handler.
   *
   */
    public onChange(callback: OnChangeHandler): () => void {
        this.onChangeHandlers.push(callback);

        return () => {
            this.onChangeHandlers.splice(this.onChangeHandlers.indexOf(callback), 1);
        };
    }

    /**
   * Formats a number.
   *
   * @param {Numeric}             input   The numeric value that will be
   *                                      formatted.
   * @param {FormatNumberOptions} options The formatting options.
   * @return {string}                     The formatted number.
   */
    public formatNumber(input: Numeric, options: FormatNumberOptions): string {
        return formatNumber(input, options);
    }

    /**
   * @param {Scope} scope The scope lookup path.
   *
   * @returns {any} The found scope.
   */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    public get(scope: Scope): any {
        return lookup(this, scope);
    }

    /**
   * @private
   *
   * @returns {void}
   */
    private runCallbacks(): void {
        this.onChangeHandlers.forEach((callback) => callback(this));
    }

    /**
   * @private
   *
   * @returns {void}
   */
    private hasChanged(): void {
        this._version += 1;

        this.runCallbacks();
    }
}
