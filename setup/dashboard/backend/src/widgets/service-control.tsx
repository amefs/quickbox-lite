import React from "react";
import ReactDOMServer from "react-dom/server";

import i18n from "../i18n";
import { getInstalledPackagesWithServices, isServiceEnabled } from "./panels";

function renderServiceToggle(service: string, username: string) {
    const enabled = isServiceEnabled(service, username);
    return (
        <div className="toggle-wrapper text-center">
            <div
                className={`${enabled ? "toggle-en" : "toggle-dis"} toggle-light primary`}
                data-click-handler="serviceUpdate"
                data-service={service}
                data-operation={enabled ? "stop,disable" : "enable,restart"}
            ></div>
        </div>
    );
}

// eslint-disable-next-line @typescript-eslint/require-await
export async function serviceControl() {
    const packages = getInstalledPackagesWithServices();

    return ReactDOMServer.renderToString(
        <div className="panel panel-inverse" data-inner-id="panel-server-service-control">
            <div className="panel-heading">
                <h4 className="panel-title">{i18n.t("SERVICE_CONTROL_CENTER")}</h4>
            </div>
            <div className="panel-body" style={{ padding: 0 }}>
                <div className="table-responsive">
                    <table className="table table-hover nomargin" style={{ fontSize: "14px" }}>
                        <thead>
                            <tr>
                                <th className="text-center">{i18n.t("SERVICE_STATUS")}</th>
                                <th className="text-center">{i18n.t("RESTART_SERVICES")}</th>
                                <th className="text-center">{i18n.t("ENABLE_DISABLE_SERVICES")}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {packages.flatMap((pkg) => Object.entries(pkg.services ?? {}).map(([service, info]) => (
                                <tr key={service}>
                                    <td>
                                        <span id={`appstat_${service}`}></span>
                                        {" "}
                                        {info.name}
                                        {info.tooltips ? (
                                            <>
                                                {" "}
                                                <span className="tooltips" data-toggle="tooltip" title={info.tooltips} data-placement="right">
                                                    <i className={`tooltips fa ${info.tooltipsicon ?? ""}`}></i>
                                                </span>
                                            </>
                                        ) : null}
                                    </td>
                                    <td className="text-center">
                                        <button
                                            data-click-handler="serviceUpdate"
                                            data-service={service}
                                            data-operation="enable,restart"
                                            className="btn btn-xs btn-default"
                                        >
                                            <i className="fa fa-refresh text-info"></i> {i18n.t("REFRESH")}
                                        </button>
                                    </td>
                                    <td className="text-center">{renderServiceToggle(service, info.username)}</td>
                                </tr>
                            )))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>,
    );
}
