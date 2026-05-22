import React from "react";
import ReactDOMServer from "react-dom/server";

import i18n from "../i18n";
import { getVisiblePackages, isPackageInstalled } from "./panels";

// eslint-disable-next-line @typescript-eslint/require-await
export async function packageManagementCenter() {
    const packages = getVisiblePackages();

    return ReactDOMServer.renderToString(
        <div className="panel panel-main panel-inverse" data-inner-id="panel-server-package-management">
            <div className="panel-heading">
                <h4 className="panel-title">{i18n.t("PACKAGE_MANAGEMENT_CENTER")}</h4>
            </div>
            <div className="panel-body text-center" style={{ padding: 0 }}>
                <div className="alert alert-danger">
                    <button type="button" className="close" data-dismiss="alert" aria-hidden="true">&times;</button>
                    <div style={{ textAlign: "center" }} dangerouslySetInnerHTML={{ __html: i18n.t("PMC_NOTICE_TXT") }}></div>
                </div>
                <div className="table-responsive ps">
                    <table id="dataTable1" className="table table-bordered table-striped-col" style={{ fontSize: "12px" }}>
                        <thead>
                            <tr>
                                <th>{i18n.t("NAME")}</th>
                                <th>{i18n.t("DETAILS")}</th>
                                <th>{i18n.t("AVAILABILITY")}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {packages.map((pkg) => {
                                const packageLowercase = pkg.package.toLowerCase();
                                const installed = isPackageInstalled(pkg);

                                return (
                                    <tr key={pkg.package}>
                                        <td>{pkg.name}</td>
                                        <td dangerouslySetInnerHTML={{ __html: pkg.description ? i18n.t(pkg.description) : "" }}></td>
                                        <td style={{ verticalAlign: "middle", textAlign: "center" }}>
                                            {installed ? (
                                                <button
                                                    data-toggle="modal"
                                                    data-target={`#${packageLowercase}RemovalConfirm`}
                                                    className="btn btn-xs btn-success package-action-btn"
                                                >
                                                    {i18n.t("INSTALLED")}
                                                </button>
                                            ) : pkg.boxonly ? (
                                                <button
                                                    data-toggle="tooltip"
                                                    title={pkg.install ? i18n.t(pkg.install) : ""}
                                                    data-placement="top"
                                                    className="btn btn-xs btn-danger disabled tooltips package-action-btn"
                                                >
                                                    {i18n.t("BOX")}
                                                </button>
                                            ) : (
                                                <button
                                                    data-click-handler="packageInstall"
                                                    data-toggle="modal"
                                                    data-target="#sysResponse"
                                                    data-package={packageLowercase}
                                                    id={`${packageLowercase}Install`}
                                                    className="btn btn-xs btn-default package-action-btn"
                                                >
                                                    {i18n.t("INSTALL")}
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                    {isPackageInstalled({ lockfile: "/install/.install.lock" }) ? (
                        <p style={{ fontSize: "10px", paddingBottom: "12px" }}>
                            <hr />
                            {i18n.t("CLEAR_LOCK_TXT")}&nbsp; &nbsp; &nbsp; &nbsp;
                            <button
                                data-toggle="modal"
                                data-target="#sysResponse"
                                className="btn btn-xs btn-info"
                            >
                                {i18n.t("VIEW_LOG")}
                            </button>
                            &nbsp; &nbsp;
                            <button
                                data-click-handler="boxHandler"
                                data-package="dpkg"
                                data-operation="fix"
                                data-toggle="modal"
                                data-target="#sysResponse"
                                className="btn btn-xs btn-default"
                            >
                                {i18n.t("CLEAR_LOCK")}
                            </button>
                        </p>
                    ) : null}
                </div>
            </div>
        </div>,
    );
}
