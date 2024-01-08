// SPDX-License-Identifier: GPL-3.0-or-later

import axios from "axios";
import https from "https";
import { Socket } from "socket.io";

import Constant from "../constant";
import { widgetsLoad } from "../widgets/load";
import { netStatus } from "../widgets/net_status";
import { upTime } from "../widgets/up";
import { diskData } from "../widgets/disk_data";
import { ramStats } from "../widgets/ram_stats";
import { getIfaceConfig } from "../utils/vnstat";
import { bwTables } from "../widgets/bw_tables";
import { serviceStatus } from "../widgets/service_status";

interface Payload {
    key: string;
    url: string;
}

const afetch = axios.create({
    baseURL: "http://127.0.0.1",
    timeout: 5000,
    httpsAgent: new https.Agent({
        rejectUnauthorized: false,
    }),
});

const iface = getIfaceConfig();

const parseUrl = (url: string) => {
    let u: URL;
    if (url.toLowerCase().startsWith("http")) {
        u = new URL(url);
    } else {
        u = new URL(url, "http://localhost");
    }
    const pathname = u.pathname;
    const args: {[key: string]: string} = {};
    u.searchParams.forEach((v, k) => {
        args[k] = v;
    });
    return {
        pathname,
        args,
    };
};


const messageHandler = async (payload: Payload, client: Socket) => {
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
        const req = parseUrl(payload.url);
        switch (req.pathname) {
            case "/node/load.php":
                ret.response = await widgetsLoad();
                break;
            case "/node/net_status.php":
                ret.response = await netStatus();
                break;
            case "/node/up.php":
                ret.response = upTime();
                break;
            case "/node/disk_data.php":
                ret.response = await diskData();
                break;
            case "/node/ram_stats.php":
                ret.response = await ramStats();
                break;
            case "/node/bw_tables.php":
                ret.response = await bwTables(iface, req.args["page"] as "h"|"d"|"m"|"t");
                break;
            case "/node/service_status.php":
                ret.response = await serviceStatus(req.args["service"] as string);
                break;
            default:
                ret.response = (await afetch.get(req.pathname, { params: req.args })).data;
                break;
        }
    } catch (error) {
        ret.message = error instanceof Error ? error.toString() : "Unknown error";
        ret.success = false;
    } finally {
        client.send(ret);
    }
};

// eslint-disable-next-line no-unused-vars
// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export default (client: Socket, next?: (err?: Error) => void) => {
    client.on(Constant.EVENT_MESSAGE, payload => messageHandler(payload, client));
    if (next) {
        next();
    }
};
