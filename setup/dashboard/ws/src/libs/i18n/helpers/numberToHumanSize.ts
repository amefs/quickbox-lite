import BigNumber from "bignumber.js";

import { I18n } from "../I18n";
import { Numeric, NumberToHumanSizeOptions } from "../typing";
import { roundNumber } from "./roundNumber";
import { expandRoundMode } from "./expandRoundMode";

/**
 * Set default size units.
 */
const STORAGE_UNITS = ["byte", "kb", "mb", "gb", "tb", "pb", "eb"];

/**
 * Formats the bytes in number into a more understandable representation.
 *
 * @param {I18n} i18n The `I18n` instance.
 *
 * @param {Numeric} input The number that will be represented.

 * @param {NumberToHumanSizeOptions} options The formatting options.

 * @return {string} The formatted number.
 */
export function numberToHumanSize(
    i18n: I18n,
    input: Numeric,
    options: NumberToHumanSizeOptions,
): string {
    const roundMode = expandRoundMode(options.roundMode);
    const base = 1024;
    const num = new BigNumber(input).abs();
    const smallerThanBase = num.lt(base);
    let numberToBeFormatted;

    const computeExponent = (numeric: BigNumber, units: string[]) => {
        const max = units.length - 1;
        const exp = new BigNumber(Math.log(numeric.toNumber()))
            .div(Math.log(base))
            .integerValue(BigNumber.ROUND_DOWN)
            .toNumber();

        return Math.min(max, exp);
    };

    const storageUnitKey = (units: string[]) => {
        const keyEnd = smallerThanBase ? "byte" : units[exponent];
        return `number.human.storage_units.units.${keyEnd}`;
    };

    const exponent = computeExponent(num, STORAGE_UNITS);

    if (smallerThanBase) {
        numberToBeFormatted = num.integerValue();
    } else {
        numberToBeFormatted = new BigNumber(
            roundNumber(num.div(base ** exponent), {
                significant: options.significant,
                precision: options.precision,
                roundMode: options.roundMode,
            }),
        );
    }

    const format = i18n.translate("number.human.storage_units.format", {
        defaultValue: "%n %u",
    });

    const unit = i18n.translate(storageUnitKey(STORAGE_UNITS), {
        count: num.integerValue().toNumber(),
    });

    let formattedNumber = numberToBeFormatted.toFixed(
        options.precision as number,
        roundMode,
    );

    if (options.stripInsignificantZeros) {
        formattedNumber = formattedNumber
            .replace(/(\..*?)0+$/, "$1")
            .replace(/\.$/, "");
    }

    return format.replace("%n", formattedNumber).replace("%u", unit);
}
