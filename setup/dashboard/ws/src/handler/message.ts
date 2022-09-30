// SPDX-License-Identifier: GPL-3.0-or-later

import axios from "axios";
import * as https from "https";
import { Socket } from "socket.io";

import Constant from "../constant";

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

const parseUrl = (url: string) => {
    let u: URL;
    if (url.toLowerCase().startsWith("http")) {
        u = new URL(url);
    } else {
        u = new URL(url, "http://localhost");
    }
    const pathName = u.pathname;
    const args = {};
    u.searchParams.forEach((v, k) => {
        args[k] = v;
    });
    return {
        pathName,
        args,
    };
};

const messageHandler = async (payload: Payload, client: Socket) => {
    const ret = {
        key: payload.key,
        pathName: payload.url,
        success: true,
        message: "",
        response: "",
    };
    try {
        const req = parseUrl(payload.url);
        ret.response = (await afetch.get(req.pathName, { params: req.args })).data;
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
