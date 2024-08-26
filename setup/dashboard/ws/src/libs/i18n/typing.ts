import BigNumber from "bignumber.js";

import { I18n } from "./I18n";

export type MakePlural = (count: number, ordinal?: boolean) => string;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Dict = Record<string, any>;

export type DateTime = string | number | Date;

export interface TimeAgoInWordsOptions {
    includeSeconds?: boolean;
    scope?: Scope;
}

export type Numeric = BigNumber | string | number;

/**
 * Controls handling of arithmetic exceptions and rounding.
 *
 * - "up": round away from zero
 * - "down" or "truncate": round towards zero (truncate)
 * - "halfUp" or "default": round towards the nearest neighbor, unless both
 *   neighbors are equidistant, in which case round away from zero.
 * - "halfDown": round towards the nearest neighbor, unless both neighbors are
 *   equidistant, in which case round towards zero.
 * - "halfEven" or "banker": round towards the nearest neighbor, unless both
 *   neighbors are equidistant, in which case round towards the even neighbor
 *   (Banker’s rounding)
 * - "ceiling" or "ceil": round towards positive infinity
 * - "floor": round towards negative infinity
 *
 * @type {string}
 */
export type RoundingMode =
  | "up"
  | "down"
  | "truncate"
  | "halfUp"
  | "default"
  | "halfDown"
  | "halfEven"
  | "banker"
  | "ceiling"
  | "ceil"
  | "floor";

export interface FormatNumberOptions {
    format: string;
    negativeFormat: string;
    precision: number | null;
    roundMode: RoundingMode;
    significant: boolean;
    separator: string;
    delimiter: string;
    stripInsignificantZeros: boolean;
    raise: boolean;
    unit: string;
}

// I18n#numberToHumanSize options.
export type NumberToHumanSizeOptions = Omit<
FormatNumberOptions,
"format" | "negativeFormat" | "raise"
>;

export type NumberToHumanUnits = Record<string, string>;

export type NumberToHumanOptions = Omit<
FormatNumberOptions,
"negativeFormat" | "unit" | "raise"
> & {
    units: NumberToHumanUnits | string;
};

export interface NumberToDelimitedOptions {
    delimiterPattern: RegExp;
    delimiter: string;
    separator: string;
}

export type NumberToPercentageOptions = Omit<FormatNumberOptions, "raise">;

export type NumberToRoundedOptions = Omit<
FormatNumberOptions,
"format" | "negativeFormat" | "raise"
> & { precision: number };

export type NumberToCurrencyOptions = FormatNumberOptions;

export interface ToSentenceOptions {
    wordsConnector: string;
    twoWordsConnector: string;
    lastWordConnector: string;
}

// Default primitive types.
export type PrimitiveType = number | string | null | undefined | boolean;
export type ArrayType = AnyObject[];
export type AnyObject = PrimitiveType | ArrayType | ObjectType;

export interface ObjectType {
    [key: string]: PrimitiveType | ArrayType | ObjectType;
}

/**
 * Possible missing translation behavior.
 * @type {String}
 */
export type MissingBehavior = "message" | "guess" | "error";

// The I18n class initializer options.
export interface I18nOptions {
    /**
   * Set default locale. This locale will be used when fallback is enabled and
   * the translation doesn't exist in a particular locale. Defaults to `en`.
   *
   * @type {string}
   */
    defaultLocale: string;

    /**
   * Set available locales. This will be used to load pluralizers automatically.
   *
   * @type {string[]}
   */
    availableLocales: string[];

    /**
   * Set the default string separator. Defaults to `.`, as in
   * `scope.translation`.
   *
   * @type {string}
   */
    defaultSeparator: string;

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
    enableFallback: boolean;

    /**
   * Set the current locale. Defaults to `en`.
   *
   * @type {string}
   */
    locale: string;

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
    missingBehavior: MissingBehavior;

    /**
   * Return a missing placeholder message for given parameters.
   *
   * @type {MissingPlaceholderHandler}
   */
    missingPlaceholder: MissingPlaceholderHandler;

    /**
   * Return a placeholder message for null values. Defaults to the same behavior
   * as `I18n.missingPlaceholder`.
   *
   * @type {NullPlaceholderHandler}
   */
    nullPlaceholder: NullPlaceholderHandler;

    /**
   * If you use missingBehavior with 'message', but want to know that the string
   * is actually missing for testing purposes, you can prefix the guessed string
   * by setting the value here. By default, no prefix is used.
   *
   * @type {string}
   */
    missingTranslationPrefix: string;

    /**
   * Set the placeholder format. Accepts `{{placeholder}}` and `%{placeholder}`.
   *
   * @type {RegExp}
   */
    placeholder: RegExp;

    /**
   * Transform keys. By default, it returns the key as it is, but allows for
   * overriding. For instance, you can set a function to receive the camelcase
   * key, and convert it to snake case.
   *
   * @type {function}
   */
    transformKey: (key: string) => string;
}

// The translation scope.
export type Scope = Readonly<string | string[]>;

// The locale resolver.
export type LocaleResolver = (i18n: I18n, locale: string) => string[];

// The pluralizer function.
export type Pluralizer = (i18n: I18n, count: number) => string[];

// The missing translation strategy.
export type MissingTranslationStrategy = (
    i18n: I18n,
    scope: Scope,
    options: Dict,
) => string;

export interface TranslateOptions {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [key: string]: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    defaultValue?: any;
    count?: number;
    scope?: Scope;
    defaults?: Dict[];
    missingBehavior?: MissingBehavior | string;
}

export type MissingPlaceholderHandler = (
    i18n: I18n,
    placeholder: string,
    message: string,
    options: Dict,
) => string;

export type NullPlaceholderHandler = (
    i18n: I18n,
    placeholder: string,
    message: string,
    options: Dict,
) => string;

export type DayNames = [string, string, string, string, string, string, string];
export type MonthNames = [
    null,
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    string,
];

export interface StrftimeOptions {
    meridian: {
        am: string;
        pm: string;
    };

    dayNames: DayNames;
    abbrDayNames: DayNames;
    monthNames: MonthNames;
    abbrMonthNames: MonthNames;
}

export type OnChangeHandler = (i18n: I18n) => void;
