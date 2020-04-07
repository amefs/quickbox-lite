import axios from "axios";
import * as https from "https";

import Constant from "../constant";


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
        u = new URL(url, "place://holder");
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

const messageHandler = async (payload: string, client: SocketIO.Socket) => {
    const ret = {
        pathName: payload,
        success: true,
        message: "",
        response: "",
    };
    try {
        const req = parseUrl(payload);
        ret.response = (await afetch.get(req.pathName, { params: req.args })).data;
    } catch (error) {
        ret.message = error ? error.toString() : "Unknown error";
        ret.success = false;
    } finally {
        client.send(ret);
    }
};

export default (client: SocketIO.Socket, next?: (err?: Error) => void) => {
    client.on(Constant.EVENT_MESSAGE, payload => messageHandler(payload, client));
    if (next) {
        next();
    }
};
