import React from "react";
import ReactDOMServer from "react-dom/server";

import { serviceMap } from "../info";
import { getProcessList, processExists, processExistsIn } from "../utils/helpers";

function renderServiceBadge(status: boolean) {
    const val = status ? "running" : "disabled";
    return ReactDOMServer.renderToString(
        <span>
            <span className={`badge badge-service-${val}-dot`}></span>
            <span className={`badge badge-service-${val}-pulse`}></span>
        </span>,
    );
}

export async function serviceStatus(service: string | undefined, checkProcess = processExists) {
    let status = false;

    if (service !== undefined) {
        const info = serviceMap.get(service);
        if (info) {
            status = await checkProcess(info.process, info.username);
        }
    }

    return renderServiceBadge(status);
}

export async function serviceStatusAll() {
    const processList = await getProcessList();
    const result: Record<string, string> = {};

    for (const [service, info] of serviceMap.entries()) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        result[service] = renderServiceBadge(processExistsIn(processList, info.process, info.username));
    }

    return result;
}
