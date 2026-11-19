// SPDX-License-Identifier: GPL-3.0-or-later

import { Socket } from "socket.io";

import Constant from "../shared/constants";
import { parseLocale, VALID_LOCALES, withLocale } from "../i18n";
import { systemLoadData, widgetsLoad } from "../widgets/load";
import { netStatus } from "../widgets/network-status";
import { getUptimeParts, upTime } from "../widgets/up";
import { diskData, diskDataData } from "../widgets/disk-data";
import { ramStats, ramStatsData } from "../widgets/memory-stats";
import { getIfaceConfig } from "../utils/vnstat";
import { bandwidthTablesData, bwTables } from "../widgets/bandwidth-tables";
import { serviceStatus, serviceStatusAll, serviceStatusAllData } from "../widgets/service-status";
import { readOutputLog } from "../widgets/output-log";
import { runningTask, runningTaskData } from "../widgets/running-task";
import { getServiceControlRows, serviceControl } from "../widgets/service-control";
import { getPackageManagementData, packageManagementCenter } from "../widgets/package-management-center";
import { parseServiceRequestV2, type ServiceRequestV2 } from "../shared/service-control-contract";
import { SYSTEM_LOAD_DATA_URL, SYSTEM_UPTIME_DATA_URL } from "../shared/system-summary-contract";

interface Payload {
    key: string;
    url: string;
    requestId?: string;
    locale?: string;
}

interface LocaleSocketData {
    locale?: string;
}

function localeData(client: Socket): LocaleSocketData {
    const withData = client as unknown as { data?: LocaleSocketData };
    if (withData.data === undefined) {
        withData.data = {};
    }
    return withData.data;
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
    "/node/load": () => widgetsLoad(),
    "/node/net_status": () => netStatus(),
    "/node/up": () => upTime(),
    [SYSTEM_LOAD_DATA_URL]: () => systemLoadData(),
    [SYSTEM_UPTIME_DATA_URL]: () => getUptimeParts(),
    "/node/disk_data": () => diskData(),
    "/node/data/disk_data": () => diskDataData(),
    "/node/ram_stats": () => ramStats(),
    "/node/data/ram_stats": () => ramStatsData(),
    "/node/bw_tables": (args) => bwTables(getIfaceConfig(), parseBandwidthPage(args)),
    "/node/data/bandwidth": (args) => bandwidthTablesData(getIfaceConfig(), parseBandwidthPage(args)),
    "/node/service_status": (args) => serviceStatus(args["service"]),
    "/widgets/service_status": (args) => serviceStatus(args["service"]),
    "/node/service_status_all": () => serviceStatusAll(),
    "/node/task_status": () => runningTask(),
    "/node/data/task_status": () => Promise.resolve(runningTaskData()),
    "/node/service_control": () => serviceControl(true),
    "/widgets/service_control": () => serviceControl(true),
    "/node/pmc": () => packageManagementCenter(),
    "/widgets/pmc": () => packageManagementCenter(),
    "/node/data/pmc": () => getPackageManagementData(),
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
        const response = await withLocale(request.locale, async () => {
            if (request.key === "SERVICE_CONTROL") {
                const rows = getServiceControlRows();
                return rows.length === 0
                    ? { meta, status: "empty" as const, data: { rows: [] as [] } }
                    : { meta, status: "success" as const, data: { rows } };
            }
            return {
                meta,
                status: "success" as const,
                data: await serviceStatusAllData(),
            };
        });
        client.send(response);
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

const resolvePayloadLocale = (payload: Payload, client: Socket) => {
    const data = localeData(client);
    const payloadLocale = parseLocale(payload.locale);
    if (payloadLocale) {
        data.locale = payloadLocale;
        return payloadLocale;
    }
    const clientLocale = data.locale;
    return typeof clientLocale === "string" && VALID_LOCALES.includes(clientLocale)
        ? clientLocale
        : "en";
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
        const locale: string = resolvePayloadLocale(payload, client);
        ret.response = await withLocale(locale, async () => await resolveWidget(payload.url));
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
