import React from "react";
import ReactDOMServer from "react-dom/server";

import { serviceMap } from "../info";
import { getProcessList, processExists, processExistsIn, systemdUnitActive } from "../utils/helpers";

export function renderServiceBadge(status: boolean) {
    const val = status ? "running" : "disabled";
    return ReactDOMServer.renderToString(
        <span>
            <span className={`badge badge-service-${val}-dot`}></span>
            <span className={`badge badge-service-${val}-pulse`}></span>
        </span>,
    );
}

export async function serviceStatus(
    service: string | undefined,
    checkProcess = processExists,
    checkSystemd = systemdUnitActive,
) {
    let status = false;

    if (service !== undefined) {
        const info = serviceMap.get(service);
        if (info) {
            if (info.systemdUnit) {
                status = await checkSystemd(info.systemdUnit);
            } else if (info.process) {
                status = await checkProcess(info.process, info.username, info.params);
            }
        }
    }

    return renderServiceBadge(status);
}

export async function serviceStatusAll(checkSystemd = systemdUnitActive) {
    const processList = await getProcessList();
    const result: Record<string, string> = {};

    for (const [service, info] of serviceMap.entries()) {
        let status: boolean;
        if (info.systemdUnit) {
            status = await checkSystemd(info.systemdUnit);
        } else {
            status = processExistsIn(processList, info.process ?? "", info.username, info.params);
        }
        result[service] = renderServiceBadge(status);
    }

    return result;
}
