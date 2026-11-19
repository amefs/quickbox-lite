import si from "systeminformation";
import React from "react";
import ReactDOMServer from "react-dom/server";
import i18n from "../i18n";
import type { UptimeParts } from "../shared/system-summary-contract";
import { UptimeValue } from "./system-summary-island";

export const getUptimeParts = (): UptimeParts => {
    const uptime = si.time().uptime;
    return {
        days: Math.floor(uptime / 60 / 60 / 24),
        hours: Math.floor(uptime / 60 / 60 % 24),
        minutes: Math.floor(uptime / 60 % 60),
    };
};

export const upTime = () => {
    return ReactDOMServer.renderToString(
        <UptimeValue
            parts={getUptimeParts()}
            labels={{ days: i18n.t("DAYS_L"), hours: i18n.t("HOURS_L"), minutes: i18n.t("MINUTES_L") }}
        />,
    );
};
