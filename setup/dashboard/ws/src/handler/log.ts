import Constant from "../constant";
import { Socket } from "socket.io";


export default (client: Socket, next?: (err?: Error) => void) => {
    const clientIp = client.handshake.headers["x-forwarded-for"] || client.handshake.address;
    console.log(`${client.id} connect from ${clientIp}`);
    client.on(Constant.EVENT_DISCONNECT, () => { console.log(`${client.id} disconnect`); });
    if (next) {
        next();
    }
};
