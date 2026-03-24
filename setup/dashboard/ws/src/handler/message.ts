// SPDX-License-Identifier: GPL-3.0-or-later

import { Socket } from "socket.io";

import Constant from "../constant";
import { widgetsLoad } from "../widgets/load";
import { netStatus } from "../widgets/net_status";
import { upTime } from "../widgets/up";
import { diskData } from "../widgets/disk_data";
import { ramStats } from "../widgets/ram_stats";
import { getIfaceConfig } from "../utils/vnstat";
import { bwTables } from "../widgets/bw_tables";
import { serviceStatus, serviceStatusAll } from "../widgets/service_status";
import { readOutputLog } from "../widgets/output_log";
import { serviceControl } from "../widgets/service_control";
import { packageManagementCenter } from "../widgets/pmc";

interface Payload {
    key: string;
    url: string;
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
        case "/node/load.php":
            return await widgetsLoad();
        case "/node/net_status.php":
            return await netStatus();
        case "/node/up.php":
            return upTime();
        case "/node/disk_data.php":
            return await diskData();
        case "/node/ram_stats.php":
            return await ramStats();
        case "/node/bw_tables.php": {
            const validPages = ["h", "d", "m", "t"];
            const page = validPages.includes(req.args["page"]) ? req.args["page"] as "h"|"d"|"m"|"t" : undefined;
            return await bwTables(iface, page);
        }
        case "/node/service_status.php":
        case "/widgets/service_status.php":
            return await serviceStatus(req.args["service"]);
        case "/node/service_status_all.php":
            return await serviceStatusAll();
        case "/node/service_control.php":
        case "/widgets/service_control.php":
            return await serviceControl();
        case "/node/pmc.php":
        case "/widgets/pmc.php":
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

const messageHandler = async (payload: unknown, client: Socket) => {
    if (!isValidPayload(payload)) {
        client.send({ key: "", pathName: "", success: false, message: "Invalid payload", response: "" });
        return;
    }
    const ret: {
        key: string;
        pathName: string;
        success: boolean;
        message: string;
        response: string|object;
    } = {
        key: payload.key,
        pathName: payload.url,
        success: true,
        message: "",
        response: "",
    };
    try {
        ret.response = await resolveWidget(payload.url);
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
