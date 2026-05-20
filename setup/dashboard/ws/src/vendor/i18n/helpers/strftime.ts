import { StrftimeOptions } from "../typing";

const DEFAULT_OPTIONS: StrftimeOptions = {
    meridian: { am: "AM", pm: "PM" },
    dayNames: [
        "Sunday",
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
    ],
    abbrDayNames: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
    monthNames: [
        null,
        "January",
        "February",
        "March",
        "April",
        "May",
        "June",
        "July",
        "August",
        "September",
        "October",
        "November",
        "December",
    ],
    abbrMonthNames: [
        null,
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
        "Oct",
        "Nov",
        "Dec",
    ],
};

/**
 * Formats time according to the directives in the given format string.
 * The directives begins with a percent (`%`) character. Any text not listed
 * as a directive will be passed through to the output string.
 *
 * The accepted formats are:
 *
 * ```
 * %a  - The abbreviated weekday name (Sun)
 * %A  - The full weekday name (Sunday)
 * %b  - The abbreviated month name (Jan)
 * %B  - The full month name (January)
 * %c  - The preferred local date and time representation
 * %d  - Day of the month (01..31)
 * %-d - Day of the month (1..31)
 * %H  - Hour of the day, 24-hour clock (00..23)
 * %-H - Hour of the day, 24-hour clock (0..23)
 * %k  - Hour of the day, 24-hour clock (0..23)
 * %I  - Hour of the day, 12-hour clock (01..12)
 * %-I - Hour of the day, 12-hour clock (1..12)
 * %l  - Hour of the day, 12-hour clock (1..12)
 * %m  - Month of the year (01..12)
 * %-m - Month of the year (1..12)
 * %M  - Minute of the hour (00..59)
 * %-M - Minute of the hour (0..59)
 * %p  - Meridian indicator (AM  or  PM)
 * %P  - Meridian indicator (am  or  pm)
 * %S  - Second of the minute (00..60)
 * %-S - Second of the minute (0..60)
 * %w  - Day of the week (Sunday is 0, 0..6)
 * %y  - Year without a century (00..99)
 * %-y - Year without a century (0..99)
 * %Y  - Year with century
 * %z  - Timezone offset (+0545)
 * %Z  - Timezone offset (+0545)
 * ```
 *
 * @private
 *
 * @param {date} date  The date that must be formatted.
 *
 * @param {string} format The formatting string.
 *
 * @param {StrftimeOptions} options The options that will be used to generate a
 * formatted date string.
 *
 * @returns {string} The formatted date string.
 */
export function strftime(
    date: Date,
    format: string,
    options: Partial<StrftimeOptions> = {},
): string {
    const {
        abbrDayNames,
        dayNames,
        abbrMonthNames,
        monthNames,
        meridian: AM_PM,
    } = { ...DEFAULT_OPTIONS, ...options };

    if (isNaN(date.getTime())) {
        throw new Error(
            "strftime() requires a valid date object, but received an invalid date.",
        );
    }

    const weekDay = date.getDay();
    const day = date.getDate();
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const hour = date.getHours();
    let hour12 = hour;
    const meridian = hour > 11 ? "pm" : "am";
    const secs = date.getSeconds();
    const mins = date.getMinutes();
    const offset = date.getTimezoneOffset();
    const absOffsetHours = Math.floor(Math.abs(offset / 60));
    const absOffsetMinutes = Math.abs(offset) - absOffsetHours * 60;
    const timezoneoffset =
    (offset > 0 ? "-" : "+") +
    (absOffsetHours.toString().length < 2
        ? "0" + absOffsetHours
        : absOffsetHours) +
    (absOffsetMinutes.toString().length < 2
        ? "0" + absOffsetMinutes
        : absOffsetMinutes);

    if (hour12 > 12) {
        hour12 = hour12 - 12;
    } else if (hour12 === 0) {
        hour12 = 12;
    }

    format = format.replace("%a", abbrDayNames[weekDay]);
    format = format.replace("%A", dayNames[weekDay]);
    format = format.replace("%b", abbrMonthNames[month] as string);
    format = format.replace("%B", monthNames[month] as string);
    format = format.replace("%d", day.toString().padStart(2, "0"));
    format = format.replace("%e", day.toString());
    format = format.replace("%-d", day.toString());
    format = format.replace("%H", hour.toString().padStart(2, "0"));
    format = format.replace("%-H", hour.toString());
    format = format.replace("%k", hour.toString());
    format = format.replace("%I", hour12.toString().padStart(2, "0"));
    format = format.replace("%-I", hour12.toString());
    format = format.replace("%l", hour12.toString());
    format = format.replace("%m", month.toString().padStart(2, "0"));
    format = format.replace("%-m", month.toString());
    format = format.replace("%M", mins.toString().padStart(2, "0"));
    format = format.replace("%-M", mins.toString());
    format = format.replace("%p", AM_PM[meridian]);
    format = format.replace("%P", AM_PM[meridian].toLowerCase());
    format = format.replace("%S", secs.toString().padStart(2, "0"));
    format = format.replace("%-S", secs.toString());
    format = format.replace("%w", weekDay.toString());
    format = format.replace("%y", year.toString().padStart(2, "0").substr(-2));
    format = format.replace(
        "%-y",
        year.toString().padStart(2, "0").substr(-2).replace(/^0+/, ""),
    );
    format = format.replace("%Y", year.toString());
    format = format.replace(/%z/i, timezoneoffset);

    return format;
}
