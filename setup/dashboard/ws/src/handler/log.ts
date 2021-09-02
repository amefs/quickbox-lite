import Constant from "../constant";
import { Socket } from "socket.io";


// eslint-disable-next-line no-unused-vars
// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export default (client: Socket, next?: (err?: Error) => void) => {
    const clientIp = client.handshake.headers["x-forwarded-for"] || client.handshake.address;
    console.log(`${client.id} connect from ${clientIp}`);
    client.on(Constant.EVENT_DISCONNECT, () => { console.log(`${client.id} disconnect`); });
    if (next) {
        next();
    }
};
