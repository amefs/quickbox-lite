import Constant from "../constant";


export default (client: SocketIO.Socket, next?: (err?: Error) => void) => {
    const clientIp = client.handshake.headers["x-forwarded-for"] || client.handshake.address;
    console.log(`${client.id} connect from ${clientIp}`);
    client.on(Constant.EVENT_DISCONNECT, () => { console.log(`${client.id} disconnect`); });
    if (next) {
        next();
    }
};
