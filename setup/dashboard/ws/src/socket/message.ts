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
import { SYSTEM_LOAD_DATA_URL, SYSTEM_UPTIME_DATA_URL } from "../shared/system-summary-contract";

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
    "/node/net_status": () => netStatus(),
    [SYSTEM_LOAD_DATA_URL]: () => systemLoadData(),
    [SYSTEM_UPTIME_DATA_URL]: () => getUptimeParts(),
    "/node/data/disk_data": () => diskDataData(),
    "/node/data/ram_stats": () => ramStatsData(),
    "/node/data/bandwidth": (args) => bandwidthTablesData(getIfaceConfig(), parseBandwidthPage(args)),
    "/node/data/task_status": () => Promise.resolve(runningTaskData()),
    "/node/data/pmc": () => getPackageManagementStateData(),
    "/node/v2/service_control": () => ({ rows: getServiceControlRows() }),
    "/node/v2/service_status_all": () => serviceStatusAllData(),
    "/db/output.log": (args) => readOutputLog(
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
        client.send({ key: "", pathName: "", success: false, message: "Invalid payload", response: "" });
        return;
    }
    const ret: {
        key: string;
        requestId?: string;
        url: string;
        pathName: string;
        success: boolean;
        message: string;
        response: string|object;
    } = {
        key: payload.key,
        requestId: payload.requestId,
        url: payload.url,
        pathName: "",
        success: true,
        message: "",
        response: "",
    };
    try {
        ret.pathName = parseUrl(payload.url).pathname;
        ret.response = await resolveWidget(payload.url);
    } catch (error) {
        console.error("[quickbox-ws] widget render failed", payload.url, error);
        ret.message = "Widget render failed";
        ret.success = false;
    } finally {
        client.send(ret);
    }
};

export default (client: Socket, next?: (err?: Error) => void) => {
    client.on(Constant.EVENT_MESSAGE, async payload => { await messageHandler(payload, client); });
    if (next) {
        next();
    }
};
