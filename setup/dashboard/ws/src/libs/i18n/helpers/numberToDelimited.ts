import BigNumber from "bignumber.js";

import { Numeric, NumberToDelimitedOptions } from "../typing";

/**
 * Formats a number with grouped thousands using delimiter (e.g., 12,324).
 *
 * @private
 *
 * @param {Numeric} input The number that will be formatted.
 *
 * @param {NumberToDelimitedOptions} options The formatting options.
 *
 * @return {string} The formatted number.
 */
export function numberToDelimited(
    input: Numeric,
    options: NumberToDelimitedOptions,
): string {
    const numeric = new BigNumber(input);

    if (!numeric.isFinite()) {
        return input.toString();
    }

    if (!options.delimiterPattern.global) {
        throw new Error(
            `options.delimiterPattern must be a global regular expression; received ${options.delimiterPattern}`,
        );
    }

    // eslint-disable-next-line prefer-const
    let [left, right] = numeric.toString().split(".");

    left = left.replace(
        options.delimiterPattern,
        (digitToDelimiter) => `${digitToDelimiter}${options.delimiter}`,
    );

    return [left, right].filter(Boolean).join(options.separator);
}
