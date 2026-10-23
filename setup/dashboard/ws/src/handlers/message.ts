// SPDX-License-Identifier: GPL-3.0-or-later

import { Socket } from "socket.io";

import Constant from "../shared/constants";
import { parseLocale, VALID_LOCALES, withLocale } from "../i18n";
import { widgetsLoad } from "../widgets/load";
import { netStatus } from "../widgets/network-status";
import { upTime } from "../widgets/up";
import { diskData } from "../widgets/disk-data";
import { ramStats } from "../widgets/memory-stats";
import { getIfaceConfig } from "../utils/vnstat";
import { bwTables } from "../widgets/bandwidth-tables";
import { serviceStatus, serviceStatusAll } from "../widgets/service-status";
import { readOutputLog } from "../widgets/output-log";
import { serviceControl } from "../widgets/service-control";
import { packageManagementCenter } from "../widgets/package-management-center";

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


type BandwidthPage = "h" | "d" | "m" | "t";

const BANDWIDTH_PAGES: BandwidthPage[] = ["h", "d", "m", "t"];

function parseBandwidthPage(raw: string | undefined): BandwidthPage | undefined {
    return BANDWIDTH_PAGES.find(page => page === raw);
}

function parseOptionalInt(raw: string | undefined): number | undefined {
    if (!raw) {
        return undefined;
    }
    const parsed = parseInt(raw, 10);
    return Number.isNaN(parsed) ? undefined : parsed;
}

export const resolveWidget = async (url: string): Promise<string|object> => {
    const req = parseUrl(url);
    switch (req.pathname) {
        case "/node/load":
            return await widgetsLoad();
        case "/node/net_status":
            return await netStatus();
        case "/node/up":
            return upTime();
        case "/node/disk_data":
            return await diskData();
        case "/node/ram_stats":
            return await ramStats();
        case "/node/bw_tables":
            return await bwTables(getIfaceConfig(), parseBandwidthPage(req.args["page"]));
        case "/node/service_status":
        case "/widgets/service_status":
            return await serviceStatus(req.args["service"]);
        case "/node/service_status_all":
            return await serviceStatusAll();
        case "/node/service_control":
        case "/widgets/service_control":
            return await serviceControl();
        case "/node/pmc":
        case "/widgets/pmc":
            return await packageManagementCenter();
        case "/db/output.log":
            return readOutputLog(
                parseOptionalInt(req.args["offset"]),
                parseOptionalInt(req.args["length"]),
                req.args["epoch"],
            );
        default:
            throw new Error(`Unknown widget route: ${req.pathname}`);
    }
};

const isValidPayload = (payload: unknown): payload is Payload => {
    return payload !== null && typeof payload === "object" &&
        "key" in payload && typeof (payload as Payload).key === "string" &&
        "url" in payload && typeof (payload as Payload).url === "string";
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
