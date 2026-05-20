// SPDX-License-Identifier: GPL-3.0-or-later

import React from "react";
import ReactDOMServer from "react-dom/server";

import i18n from "../i18n";
import { getVisiblePackages } from "./panels";

// eslint-disable-next-line @typescript-eslint/require-await
export async function removalModals() {
    const packages = getVisiblePackages()
        .filter((pkg) => !pkg.boxonly && !pkg.skip && pkg.uninstall)
        .map((pkg) => ({
            ...pkg,
            packageLowercase: pkg.package.toLowerCase(),
            packageUppercase: pkg.package.toUpperCase(),
        }));

    return ReactDOMServer.renderToString(
        <>
            {packages.map((pkg) => (
                <div
                    key={pkg.package}
                    className="modal animate__bounceIn animate__animated"
                    id={`${pkg.packageLowercase}RemovalConfirm`}
                    tabIndex={-1}
                    role="dialog"
                    aria-labelledby={`${pkg.packageUppercase}RemovalConfirm`}
                    aria-hidden="true"
                >
                    <div className="modal-dialog">
                        <div className="modal-content">
                            <div className="modal-header">
                                <button type="button" className="close" data-dismiss="modal" aria-hidden="true">&times;</button>
                                <h4 className="modal-title" id={`${pkg.packageUppercase}RemovalConfirm`}>
                                    {i18n.t("UNINSTALL_TITLE")} {pkg.name}?
                                </h4>
                            </div>
                            <div className="modal-body">{i18n.t(pkg.uninstall as string)}</div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-default" data-dismiss="modal">{i18n.t("CANCEL")}</button>
                                <button
                                    data-click-handler="packageRemove"
                                    data-dismiss="modal"
                                    data-toggle="modal"
                                    data-target="#sysResponse"
                                    data-package={pkg.packageLowercase}
                                    data-package-name={pkg.name}
                                    id={`${pkg.packageLowercase}Remove`}
                                    className="btn btn-primary"
                                >
                                    {i18n.t("AGREE")}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            ))}
        </>,
    );
}
