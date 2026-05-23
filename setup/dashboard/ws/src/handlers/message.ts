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
    return (client as unknown as { data: LocaleSocketData }).data;
}

const iface = getIfaceConfig();

const parseUrl = (url: string) => {
    let u: URL;
    if (url.toLowerCase().startsWith("http")) {
        u = new URL(url);
    } else {
        u = new URL(url, "http://localhost");
    }
    const pathname = u.pathname;
    const args: Record<string, string> = {};
    u.searchParams.forEach((v, k) => {
        args[k] = v;
    });
    return {
        pathname,
        args,
    };
};


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
        case "/node/bw_tables": {
            const validPages = ["h", "d", "m", "t"];
            const page = validPages.includes(req.args["page"]) ? req.args["page"] as "h"|"d"|"m"|"t" : undefined;
            return await bwTables(iface, page);
        }
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
        case "/db/output.log": {
            const rawOffset = req.args["offset"];
            const rawLength = req.args["length"];
            const offset = rawOffset ? parseInt(rawOffset, 10) : undefined;
            const length = rawLength ? parseInt(rawLength, 10) : undefined;
            return readOutputLog(
                Number.isNaN(offset) ? undefined : offset,
                Number.isNaN(length) ? undefined : length,
            );
        }
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
        pathName: parseUrl(payload.url).pathname,
        success: true,
        message: "",
        response: "",
    };
    try {
        const locale: string = resolvePayloadLocale(payload, client);
        ret.response = await withLocale(locale, async () => await resolveWidget(payload.url));
    } catch (error) {
        ret.message = error instanceof Error ? error.toString() : "Unknown error";
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
