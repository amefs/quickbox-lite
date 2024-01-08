import si from "systeminformation";
import React from "react";
import ReactDOMServer from "react-dom/server";
import i18n from "../i18n";

export const upTime = () => {
    const uptime = si.time().uptime;
    const days   = Math.floor(uptime / 60 / 60 / 24);
    const hours  = Math.floor(uptime / 60 / 60 % 24);
    const mins   = Math.floor(uptime / 60 % 60);

    return ReactDOMServer.renderToString(
        <span style={{ fontSize: "14px" }}>
            <b>{days}</b><small>{ i18n.t("DAYS_L") }</small>
            <b>{hours}</b><small>{ i18n.t("HOURS_L") }</small>
            <b>{mins}</b><small>{ i18n.t("MINUTES_L") }</small>
        </span>);
};
