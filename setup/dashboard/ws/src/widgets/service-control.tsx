import React from "react";
import ReactDOMServer from "react-dom/server";

import i18n from "../i18n";
import { getInstalledPackagesWithServices, isServiceEnabled } from "./panels";
import { renderServiceBadge } from "./service-status";
import { getServiceSnapshot } from "./service-state";

function renderServiceToggle(service: string, username: string) {
    const enabled = isServiceEnabled(service, username);
    return (
        <div className="toggle-wrapper text-center">
            <div
                className={`${enabled ? "toggle-en" : "toggle-dis"} toggle-light primary`}
                data-click-handler="serviceUpdate"
                data-service={service}
                data-service-action={enabled ? "disable" : "enable"}
            ></div>
        </div>
    );
}

export async function serviceControl(includeCurrentStatus = false) {
    const packages = getInstalledPackagesWithServices();
    const unknownStatus = renderServiceBadge({ value: null, observedAt: null, stale: true });
    const currentStatus = includeCurrentStatus ? await getServiceSnapshot() : undefined;

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
                                        <span
                                            id={`appstat_${service}`}
                                            dangerouslySetInnerHTML={{ __html: currentStatus?.[service] ? renderServiceBadge(currentStatus[service]) : unknownStatus }}
                                        ></span>
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
                                            data-service-action="restart"
                                            className="btn btn-xs btn-default"
                                        >
                                            <i className="fa fa-refresh text-info"></i> {i18n.t("RESTART_SERVICES")}
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
