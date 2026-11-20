// SPDX-License-Identifier: GPL-3.0-or-later

import React from "react";
import { InfoCircleOutlined, SyncOutlined, UsbOutlined } from "@ant-design/icons";
import { Button, ConfigProvider, Switch, Tooltip } from "antd";

import type { ServiceRow, ServiceState } from "../../../ws/src/shared/service-control-contract";
import type { DashboardTheme } from "../../../ws/src/shared/theme";
import { getAntdThemeConfig } from "../runtime/theme-store";
import { SkeletonText } from "./placeholder";

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

export type ServiceControlTheme = DashboardTheme;

export interface ServiceControlIslandProps {
    rows: ServiceRow[];
    labels: ServiceControlLabels;
    theme: ServiceControlTheme;
    statusById: Record<string, ServiceState>;
    pendingById?: Record<string, boolean>;
    commandsDisabled: boolean;
    loading?: boolean;
    onRefresh?: (serviceId: string) => void;
    onEnabledChange?: (serviceId: string, enabled: boolean) => void;
}

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

export function ServiceControlIsland({ rows, labels, theme, statusById, pendingById = {}, commandsDisabled, loading = false, onRefresh, onEnabledChange }: ServiceControlIslandProps) {
    return (
        <ConfigProvider theme={getAntdThemeConfig(theme, { borderRadius: 2, fontFamily: "inherit" })}>
            <div className={`panel panel-inverse qb-service-control qb-service-control--${theme}`} data-inner-id="panel-server-service-control" aria-busy={loading}>
                <div className="panel-heading">
                    <h2 className="panel-title">{labels.title}</h2>
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
                                {loading ? [0, 1, 2].map((index) => (
                                    <tr key={index} aria-hidden="true">
                                        <td><SkeletonText width="8ch" /></td>
                                        <td className="text-center"><SkeletonText width="6ch" /></td>
                                        <td className="text-center">
                                            <div className="toggle-wrapper text-center">
                                                <div className="qb-skeleton qb-skeleton-btn" />
                                            </div>
                                        </td>
                                    </tr>
                                )) : rows.map((row) => (
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
                                                            {row.tooltipIcon === "usb" ? <UsbOutlined aria-hidden="true" /> : <InfoCircleOutlined aria-hidden="true" />}
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
                                                disabled={commandsDisabled || pendingById[row.id]}
                                                onClick={() => onRefresh?.(row.id)}
                                            >
                                                <SyncOutlined className="text-info" spin={pendingById[row.id]} aria-hidden="true" /> {labels.refresh}
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
                                                    loading={pendingById[row.id]}
                                                    disabled={commandsDisabled || pendingById[row.id]}
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
