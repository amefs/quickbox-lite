import { I18n } from "../I18n";
import { Pluralizer } from "../typing";

export const westSlavic: Pluralizer = (_i18n: I18n, count: number) => {
    const few = [2, 3, 4];
    let key;

    if (count === 1) {
        key = "one";
    } else if (few.includes(count)) {
        key = "few";
    } else {
        key = "other";
    }

    return [key];
};
