// SPDX-License-Identifier: GPL-3.0-or-later

import React from "react";
import { Button, ConfigProvider, Switch, Tooltip } from "antd";
import { createCache, extractStyle, StyleProvider } from "@ant-design/cssinjs";
import ReactDOMServer from "react-dom/server";

import type { ServiceRow, ServiceState } from "../shared/service-control-contract";

export interface ServiceControlLabels {
    title: string;
    status: string;
    restart: string;
    enableDisable: string;
    refresh: string;
    enabled: string;
    disabled: string;
    serviceStatusUnconfirmed: string;
    serviceStatusStale: string;
    serviceStatusLastConfirmedTemplate: string;
}

export type ServiceControlTheme = "defaulted" | "smoked";

export interface ServiceControlIslandProps {
    rows: ServiceRow[];
    labels: ServiceControlLabels;
    theme: ServiceControlTheme;
    statusById: Record<string, ServiceState>;
    pendingById?: Record<string, boolean>;
    onRefresh?: (serviceId: string) => void;
    onEnabledChange?: (serviceId: string, enabled: boolean) => void;
}

const serviceControlTheme = {
    token: {
        colorPrimary: "#2574ab",
        fontFamily: '"Open Sans", sans-serif',
        borderRadius: 3,
    },
};

function ServiceBadge({ status, labels }: { status: ServiceState | undefined; labels: ServiceControlLabels }) {
    const current = status ?? { value: null, observedAt: null, stale: true };
    const state = current.value === null ? "unknown" : current.value ? "running" : "disabled";
    const confirmed = current.observedAt === null
        ? labels.serviceStatusUnconfirmed
        : labels.serviceStatusLastConfirmedTemplate.replace("__SERVICE_STATUS_TIME__", new Date(current.observedAt).toISOString());
    const title = current.stale ? `${confirmed}; ${labels.serviceStatusStale}` : current.value === null ? confirmed : undefined;
    return (
        <span title={title} aria-label={title ?? `${state} service`} data-observed-at={current.observedAt ?? undefined}>
            <span className={`badge badge-service-${state}-dot${current.stale ? " badge-service-stale" : ""}`}></span>
            <span className={`badge badge-service-${state}-pulse${current.stale ? " badge-service-stale" : ""}`}></span>
        </span>
    );
}

export function ServiceControlIsland({ rows, labels, theme, statusById, pendingById = {}, onRefresh, onEnabledChange }: ServiceControlIslandProps) {
    return (
        <ConfigProvider theme={serviceControlTheme}>
            <div className={`panel panel-inverse qb-service-control qb-service-control--${theme}`} data-inner-id="panel-server-service-control">
                <div className="panel-heading">
                    <h4 className="panel-title">{labels.title}</h4>
                </div>
                <div className="panel-body" style={{ padding: 0 }}>
                    <div className="table-responsive">
                        <table className="table table-hover nomargin" style={{ fontSize: "14px" }}>
                            <thead>
                                <tr>
                                    <th className="text-center">{labels.status}</th>
                                    <th className="text-center">{labels.restart}</th>
                                    <th className="text-center">{labels.enableDisable}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((row) => (
                                    <tr key={row.id}>
                                        <td>
                                            <span id={`appstat_${row.id}`}><ServiceBadge status={statusById[row.id]} labels={labels} /></span>
                                            {" "}
                                            {row.name}
                                            {row.tooltip ? (
                                                <>
                                                    {" "}
                                                    <Tooltip
                                                        title={row.tooltip}
                                                        placement="right"
                                                        classNames={{ root: "qb-service-tooltip-popup" }}
                                                    >
                                                        <span className="qb-service-tooltip" data-placement="right">
                                                            <i className={`fa ${row.tooltipIcon ?? ""}`} aria-hidden="true"></i>
                                                        </span>
                                                    </Tooltip>
                                                </>
                                            ) : null}
                                        </td>
                                        <td className="text-center">
                                            <Button
                                                type="default"
                                                size="small"
                                                className="btn btn-xs btn-default qb-service-refresh"
                                                disabled={pendingById[row.id]}
                                                onClick={() => onRefresh?.(row.id)}
                                            >
                                                <i className="fa fa-refresh text-info" aria-hidden="true"></i> {labels.refresh}
                                            </Button>
                                        </td>
                                        <td className="text-center">
                                            <div className="toggle-wrapper text-center">
                                                <Switch
                                                    className="qb-service-switch"
                                                    checked={row.enabledAtBoot}
                                                    checkedChildren={labels.enabled}
                                                    unCheckedChildren={labels.disabled}
                                                    aria-label={row.name}
                                                    disabled={pendingById[row.id]}
                                                    onChange={(enabled) => onEnabledChange?.(row.id, enabled)}
                                                />
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </ConfigProvider>
    );
}

export function renderServiceControlIsland(props: Omit<ServiceControlIslandProps, "onRefresh" | "onEnabledChange">) {
    const cache = createCache();
    const html = ReactDOMServer.renderToString(
        <StyleProvider cache={cache}>
            <ServiceControlIsland {...props} />
        </StyleProvider>,
    );
    const styleMarkup = extractStyle(cache);
    return { html, styleMarkup };
}
