import React from "react";
import ReactDOMServer from "react-dom/server";

import { serviceMap } from "../info";
import { processExists } from "../utils/helpers";

export async function serviceStatus(service: string | undefined, checkProcess = processExists) {
    let status = false;

    if (service !== undefined) {
        const info = serviceMap.get(service);
        if (info) {
            status = await checkProcess(info.process, info.username);
        }
    }

    const val = status ? "running" : "disabled";

    return ReactDOMServer.renderToString(
        <span>
            <span className={`badge badge-service-${val}-dot`}></span>
            <span className={`badge badge-service-${val}-pulse`}></span>
        </span>,
    );
}
