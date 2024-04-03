import BigNumber from "bignumber.js";
import { sortBy, zipObject } from "lodash";

import { I18n } from "../I18n";
import { Numeric, NumberToHumanOptions, NumberToHumanUnits } from "../typing";
import { getFullScope } from "./getFullScope";
import { lookup } from "./lookup";
import { roundNumber } from "./roundNumber";
import { inferType } from "./inferType";

/**
 * Set decimal units used to calculate number to human formatting.
 */
const DECIMAL_UNITS = {
    "0": "unit",
    "1": "ten",
    "2": "hundred",
    "3": "thousand",
    "6": "million",
    "9": "billion",
    "12": "trillion",
    "15": "quadrillion",
    "-1": "deci",
    "-2": "centi",
    "-3": "mili",
    "-6": "micro",
    "-9": "nano",
    "-12": "pico",
    "-15": "femto",
};

const INVERTED_DECIMAL_UNITS = zipObject(
    Object.values(DECIMAL_UNITS),
    Object.keys(DECIMAL_UNITS).map((key) => parseInt(key, 10)),
);

/**
 * Pretty prints (formats and approximates) a number in a way it is more
 * readable by humans.
 *
 * @private
 *
 * @param {I18n} i18n The `I18n` instance.
 *
 * @param {Numeric} input The numeric value that will be represented.
 *
 * @param {NumberToHumanOptions} options The formatting options.
 *
 * @return {string} The formatted number.
 */
export function numberToHuman(
    i18n: I18n,
    input: Numeric,
    options: NumberToHumanOptions,
): string {
    const roundOptions = {
        roundMode: options.roundMode,
        precision: options.precision,
        significant: options.significant,
    };

    let units: NumberToHumanUnits;

    if (inferType(options.units) === "string") {
        const scope = options.units as string;
        units = lookup(i18n, scope);

        if (!units) {
            throw new Error(
                `The scope "${i18n.locale}${i18n.defaultSeparator}${getFullScope(
                    i18n,
                    scope,
                    {},
                )}" couldn't be found`,
            );
        }
    } else {
        units = options.units as NumberToHumanUnits;
    }

    let formattedNumber = roundNumber(new BigNumber(input), roundOptions);

    const unitExponents = (units: NumberToHumanUnits) =>
        sortBy(
            Object.keys(units).map((name) => INVERTED_DECIMAL_UNITS[name]),
            (numeric) => numeric * -1,
        );

    const calculateExponent = (num: BigNumber, units: NumberToHumanUnits) => {
        const exponent = num.isZero()
            ? 0
            : Math.floor(Math.log10(num.abs().toNumber()));

        return unitExponents(units).find((exp) => exponent >= exp) || 0;
    };

    const determineUnit = (units: NumberToHumanUnits, exponent: number) => {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
        const expName = DECIMAL_UNITS[exponent.toString()];

        return units[expName] || "";
    };

    const exponent = calculateExponent(new BigNumber(formattedNumber), units);
    const unit = determineUnit(units, exponent);

    formattedNumber = roundNumber(
        new BigNumber(formattedNumber).div(10 ** exponent),
        roundOptions,
    );

    if (options.stripInsignificantZeros) {
    // eslint-disable-next-line prefer-const
        let [whole, significand] = formattedNumber.split(".");
        significand = (significand || "").replace(/0+$/, "");

        formattedNumber = whole;

        if (significand) {
            formattedNumber += `${options.separator}${significand}`;
        }
    }

    return options.format
        .replace("%n", formattedNumber || "0")
        .replace("%u", unit)
        .trim();
}
