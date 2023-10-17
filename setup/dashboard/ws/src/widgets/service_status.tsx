import React from "react";
import ReactDOMServer from "react-dom/server";

import { packageList } from "../info";
import { processExists } from "../utils";

const packageWithService = packageList.filter((pkg) => pkg.services !== undefined);

export async function serviceStatus(service: string) {
    let status = false;

    for (const pkg of packageWithService) {
        if (service === undefined) {
            break;
        }
        let matched = false;
        if (pkg.services === undefined) {
            continue;
        }
        for (const [k, info] of Object.entries(pkg.services)) {
            if (k === service) {
                const process = info.process;
                const username = info.username;
                status = await processExists(process, username);
                matched = true;
                break;
            }
        }
        if (matched) {
            break;
        }
    }

    const val = status ? "running" : "disabled";

    return ReactDOMServer.renderToString(
        <span>
            <span className={`badge badge-service-${val}-dot`}></span>
            <span className={`badge badge-service-${val}-pulse`}></span>
        </span>
    );
}
