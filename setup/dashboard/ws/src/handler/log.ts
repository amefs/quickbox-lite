// SPDX-License-Identifier: GPL-3.0-or-later

import Constant from "../constant";
import { Socket } from "socket.io";


function sanitizeIp(raw: string | string[] | undefined): string {
    const value = Array.isArray(raw) ? raw[0] : raw;
    // eslint-disable-next-line no-control-regex
    return (value ?? "").replace(/[\x00-\x1f\x7f]/g, "");
}

export default (client: Socket, next?: (err?: Error) => void) => {
    const clientIp = sanitizeIp(client.handshake.headers["x-forwarded-for"]) || client.handshake.address;
    console.log(`${client.id} connect from ${clientIp}`);
    client.on(Constant.EVENT_DISCONNECT, () => { console.log(`${client.id} disconnect`); });
    if (next) {
        next();
    }
};
