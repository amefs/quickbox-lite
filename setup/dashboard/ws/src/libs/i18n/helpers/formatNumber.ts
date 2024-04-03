import BigNumber from "bignumber.js";
import { repeat } from "lodash";

import { FormatNumberOptions, Numeric } from "../typing";
import { roundNumber } from "./roundNumber";

function replaceInFormat(
    format: string,
    { formattedNumber, unit }: { formattedNumber: string; unit: string },
): string {
    return format.replace("%n", formattedNumber).replace("%u", unit);
}

function computeSignificand({
    significand,
    whole,
    precision,
}: {
    significand: string;
    whole: string;
    precision: number | null;
}) {
    if (whole === "0" || precision === null) {
        return significand;
    }

    const limit = Math.max(0, precision - whole.length);

    return (significand ?? "").substr(0, limit);
}

/**
 * Formats a number.
 *
 * @param {Numeric} input The numeric value that will be formatted.
 *
 * @param {FormatNumberOptions} options The formatting options.
 *
 * @return {string}                      [description]
 */
export function formatNumber(
    input: Numeric,
    options: FormatNumberOptions,
): string {
    const originalNumber = new BigNumber(input);

    if (options.raise && !originalNumber.isFinite()) {
        throw new Error(`"${input}" is not a valid numeric value`);
    }

    const roundedNumber = roundNumber(originalNumber, options);
    const numeric = new BigNumber(roundedNumber);
    const isNegative = numeric.lt(0);
    const isZero = numeric.isZero();
    let [whole, significand] = roundedNumber.split(".");
    const buffer: string[] = [];
    let formattedNumber: string;
    const positiveFormat = options.format ?? "%n";
    const negativeFormat = options.negativeFormat ?? `-${positiveFormat}`;
    const format = isNegative && !isZero ? negativeFormat : positiveFormat;

    whole = whole.replace("-", "");

    while (whole.length > 0) {
        buffer.unshift(whole.substr(Math.max(0, whole.length - 3), 3));
        whole = whole.substr(0, whole.length - 3);
    }

    whole = buffer.join("");
    formattedNumber = buffer.join(options.delimiter);

    if (options.significant) {
        significand = computeSignificand({
            whole,
            significand,
            precision: options.precision,
        });
    } else {
        significand = significand ?? repeat("0", options.precision ?? 0);
    }

    if (options.stripInsignificantZeros && significand) {
        significand = significand.replace(/0+$/, "");
    }

    if (originalNumber.isNaN()) {
        formattedNumber = input.toString();
    }

    if (significand && originalNumber.isFinite()) {
        formattedNumber += (options.separator || ".") + significand;
    }

    return replaceInFormat(format, {
        formattedNumber,
        unit: options.unit,
    });
}
