// SPDX-License-Identifier: GPL-3.0-or-later

import { Socket } from "socket.io";

import Constant from "../shared/constants";
import { systemLoadData } from "../services/system/load";
import { netStatus } from "../services/system/network";
import { getUptimeParts } from "../services/system/uptime";
import { diskDataData } from "../services/system/disk";
import { ramStatsData } from "../services/system/memory";
import { getIfaceConfig } from "../utils/vnstat";
import { bandwidthTablesData } from "../services/system/bandwidth";
import { serviceStatusAllData } from "../services/service/status";
import { readOutputLog } from "../services/output-log";
import { runningTaskData } from "../services/packages/running-task";
import { getServiceControlRows } from "../services/service/control";
import { getPackageManagementStateData } from "../services/packages/pmc";
import { parseServiceRequestV2, type ServiceRequestV2 } from "../shared/service-control-contract";
import {
    BANDWIDTH_DATA_URL,
    DISK_DATA_URL,
    NETWORK_STATUS_URL,
    OUTPUT_LOG_URL,
    PACKAGE_MANAGEMENT_DATA_URL,
    RAM_STATS_DATA_URL,
    SERVICE_CONTROL_URL,
    SERVICE_STATUS_ALL_URL,
    SYSTEM_LOAD_DATA_URL,
    SYSTEM_UPTIME_DATA_URL,
    TASK_STATUS_DATA_URL,
} from "../shared/widget-streams";
import { createWsMessageEnvelope } from "../shared/ws-message";

interface Payload {
    key: string;
    url: string;
    requestId?: string;
}

export const parseUrl = (url: string) => {
    let parsed: URL;
    try {
        if (url.toLowerCase().startsWith("http")) {
            parsed = new URL(url);
        } else {
            parsed = new URL(url, "http://localhost");
        }
    } catch {
        throw new Error("Invalid widget URL");
    }
    const pathname = parsed.pathname;
    const args: Record<string, string> = {};
    parsed.searchParams.forEach((value, key) => {
        args[key] = value;
    });
    return {
        pathname,
        args,
    };
};

type WidgetHandler = (args: Record<string, string>) => Promise<string | object> | string | object;

const validBandwidthPages = ["h", "d", "m", "t"] as const;
type BandwidthPage = typeof validBandwidthPages[number];

function parseBandwidthPage(args: Record<string, string>): BandwidthPage | undefined {
    const page = args["page"];
    return validBandwidthPages.includes(page as BandwidthPage) ? page as BandwidthPage : undefined;
}

function parseLogPosition(value: string | undefined) {
    const parsed = value ? Number.parseInt(value, 10) : undefined;
    return Number.isNaN(parsed) ? undefined : parsed;
}

const widgetHandlers: Partial<Record<string, WidgetHandler>> = {
    [NETWORK_STATUS_URL]: () => netStatus(),
    [SYSTEM_LOAD_DATA_URL]: () => systemLoadData(),
    [SYSTEM_UPTIME_DATA_URL]: () => getUptimeParts(),
    [DISK_DATA_URL]: () => diskDataData(),
    [RAM_STATS_DATA_URL]: () => ramStatsData(),
    [BANDWIDTH_DATA_URL]: (args) => bandwidthTablesData(getIfaceConfig(), parseBandwidthPage(args)),
    [TASK_STATUS_DATA_URL]: () => Promise.resolve(runningTaskData()),
    [PACKAGE_MANAGEMENT_DATA_URL]: () => getPackageManagementStateData(),
    [SERVICE_CONTROL_URL]: () => ({ rows: getServiceControlRows() }),
    [SERVICE_STATUS_ALL_URL]: () => serviceStatusAllData(),
    [OUTPUT_LOG_URL]: (args) => readOutputLog(
        parseLogPosition(args["offset"]),
        parseLogPosition(args["length"]),
        args["epoch"],
    ),
};

export const resolveWidget = async (url: string): Promise<string|object> => {
    const req = parseUrl(url);
    const handler = widgetHandlers[req.pathname];
    if (!handler) {
        throw new Error(`Unknown widget route: ${req.pathname}`);
    }
    return await handler(req.args);
};

const isValidPayload = (payload: unknown): payload is Payload => {
    return payload !== null && typeof payload === "object" &&
        "key" in payload && typeof (payload as Payload).key === "string" &&
        "url" in payload && typeof (payload as Payload).url === "string";
};

const isRecord = (payload: unknown): payload is Record<string, unknown> =>
    payload !== null && typeof payload === "object" && !Array.isArray(payload);

const messageServiceV2 = async (request: ServiceRequestV2, client: Socket) => {
    const meta = {
        protocolVersion: 2 as const,
        key: request.key,
        url: request.url,
        requestId: request.requestId,
        locale: request.locale,
        generation: request.generation,
    };
    try {
        if (request.key === "SERVICE_CONTROL") {
            const rows = getServiceControlRows();
            client.send(rows.length === 0
                ? { meta, status: "empty" as const, data: { rows: [] as [] } }
                : { meta, status: "success" as const, data: { rows } });
        } else {
            client.send({
                meta,
                status: "success" as const,
                data: await serviceStatusAllData(),
            });
        }
    } catch {
        const isControl = request.key === "SERVICE_CONTROL";
        client.send({
            meta,
            status: "error",
            error: {
                code: isControl ? "SERVICE_CONTROL_UNAVAILABLE" : "SERVICE_STATUS_UNAVAILABLE",
                message: isControl ? "Service control data unavailable." : "Service status unavailable.",
            },
        });
    }
};

const messageHandler = async (payload: unknown, client: Socket) => {
    if (isRecord(payload) && Object.hasOwn(payload, "protocolVersion")) {
        const request = parseServiceRequestV2(payload);
        if (request) {
            await messageServiceV2(request, client);
        }
        return;
    }
    if (!isValidPayload(payload)) {
        client.send(createWsMessageEnvelope({ key: "", url: "", pathName: "", success: false, message: "Invalid payload", response: "" }));
        return;
    }
    let pathName = "";
    let response: string | object = "";
    let success = true;
    let message = "";
    try {
        pathName = parseUrl(payload.url).pathname;
        response = await resolveWidget(payload.url);
    } catch (error) {
        console.error("[quickbox-ws] widget render failed", payload.url, error);
        message = "Widget render failed";
        success = false;
    } finally {
        client.send(createWsMessageEnvelope({
            key: payload.key,
            requestId: payload.requestId,
            url: payload.url,
            pathName,
            success,
            message,
            response,
        }));
    }
};

export default (client: Socket, next?: (err?: Error) => void) => {
    client.on(Constant.EVENT_MESSAGE, async payload => { await messageHandler(payload, client); });
    if (next) {
        next();
    }
};
