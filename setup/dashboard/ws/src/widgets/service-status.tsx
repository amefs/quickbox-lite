import React from "react";
import ReactDOMServer from "react-dom/server";

import i18n from "../i18n";
import { getServiceHealth, getServiceSnapshot, type ServiceState } from "./service-state";

export function renderServiceBadge(state: boolean | ServiceState, observedAt?: number | null, stale = false) {
    const detail: ServiceState = typeof state === "boolean" ? { value: state, observedAt: observedAt ?? null, stale } : state;
    const val = detail.value === null ? "unknown" : detail.value ? "running" : "disabled";
    const stateLabel = detail.value === null ? "unknown" : detail.value ? "running" : "stopped";
    const age = detail.observedAt ? i18n.t("SERVICE_STATUS_LAST_CONFIRMED", { time: new Date(detail.observedAt).toISOString() }) : i18n.t("SERVICE_STATUS_UNCONFIRMED");
    const title = detail.stale ? `${age}; ${i18n.t("SERVICE_STATUS_STALE")}` : detail.value === null ? age : "";
    return ReactDOMServer.renderToString(
        <span title={title || undefined} aria-label={title || `${stateLabel} service`} data-observed-at={detail.observedAt ?? undefined}>
            <span className={`badge badge-service-${val}-dot${detail.stale ? " badge-service-stale" : ""}`}></span>
            <span className={`badge badge-service-${val}-pulse${detail.stale ? " badge-service-stale" : ""}`}></span>
        </span>,
    );
}

export async function serviceStatus(service: string | undefined) {
    const state = service ? (await getServiceSnapshot())[service] : undefined;
    return renderServiceBadge(state ?? { value: null, observedAt: null, stale: true });
}

export async function serviceStatusAll() {
    const { snapshot, health, retryAfterMs } = await getServiceHealth();
    const badges: Record<string, string> = {};
    for (const [service, state] of Object.entries(snapshot)) {badges[service] = renderServiceBadge(state);}
    return { badges, health, retryAfterMs };
}
