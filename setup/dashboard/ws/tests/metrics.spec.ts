// SPDX-License-Identifier: GPL-3.0-or-later

import "mocha";
import { expect } from "chai";
import { once } from "events";
import type { AddressInfo } from "net";
import { io, type Socket } from "socket.io-client";
import request from "supertest";

import { GATEWAY_HEADER, resetGatewaySecretCache } from "../src/auth";
import { app, server } from "../src/server";
import { getServiceHealth, setServiceStateCollectorsForTests } from "../src/services/service/state";

async function connectSocket(baseUrl: string, path: string, transport: "polling" | "websocket"): Promise<Socket> {
    const socket = io(baseUrl, { path, transports: [transport], reconnection: false, timeout: 2_000, autoConnect: false });
    try {
        await new Promise<void>((resolve, reject) => {
            socket.once("connect", resolve);
            socket.once("connect_error", reject);
            socket.connect();
        });
        return socket;
    } catch (error) {
        socket.close();
        throw error;
    }
}

describe("GET /metrics", () => {
    it("exposes a passive Prometheus scrape on loopback without granting access to dashboard APIs", async () => {
        const envSecret = process.env.QUICKBOX_WS_GATEWAY_SECRET;
        const envAuth = process.env.QUICKBOX_WS_AUTH;
        process.env.QUICKBOX_WS_GATEWAY_SECRET = "fixture-metrics-gateway-secret";
        delete process.env.QUICKBOX_WS_AUTH;
        let collections = 0;
        const collect = () => {
            collections += 1;
            return Promise.resolve(new Map<string, boolean>());
        };
        setServiceStateCollectorsForTests({ systemd: collect, process: collect });
        try {
            const res = await request(app).get("/metrics");
            expect(res.status).to.equal(200);
            expect(res.headers["content-type"]).to.match(/^text\/plain;.*version=0\.0\.4/);
            expect(res.headers["cache-control"]).to.equal("no-store");
            expect(res.text).to.include("# TYPE quickbox_ws_healthy gauge\nquickbox_ws_healthy 1\n");
            expect(res.text).to.match(/quickbox_ws_process_resident_memory_bytes [1-9]\d*\n/);
            expect(res.text).to.include('quickbox_ws_service_collector_status{collector="systemd",state="unknown"} 1\n');
            expect(res.text).to.include('quickbox_ws_push_samplers{stream="NETWORK"} 0\n');
            expect(res.text).to.include('quickbox_ws_push_samples_total{stream="NETWORK",result="timeout"} 0\n');
            expect(res.text.endsWith("\n")).to.equal(true);
            expect(collections).to.equal(0);

            await getServiceHealth();
            const observed = await request(app).get("/metrics").expect(200);
            expect(observed.text).to.include('quickbox_ws_service_collector_status{collector="systemd",state="degraded"} 1\n');
            expect(observed.text).to.include('quickbox_ws_service_collector_status{collector="process",state="ok"} 1\n');
            expect(collections).to.equal(2);
            expect((await request(app).get("/node/bootstrap")).status).to.equal(401);

            await request(app).get("/metrics").set("X-Forwarded-For", "127.0.0.1").expect(403);
            await request(app).get("/metrics").set(GATEWAY_HEADER, process.env.QUICKBOX_WS_GATEWAY_SECRET).expect(403);
        } finally {
            setServiceStateCollectorsForTests();
            if (envSecret === undefined) {delete process.env.QUICKBOX_WS_GATEWAY_SECRET;}
            else {process.env.QUICKBOX_WS_GATEWAY_SECRET = envSecret;}
            if (envAuth === undefined) {delete process.env.QUICKBOX_WS_AUTH;}
            else {process.env.QUICKBOX_WS_AUTH = envAuth;}
            resetGatewaySecretCache();
        }
    });

    it("counts real connections on both Socket.IO paths by their active transport", async function() {
        this.timeout(6_000);
        server.listen(0, "127.0.0.1");
        await once(server, "listening");
        const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
        const sockets: Socket[] = [];
        try {
            sockets.push(await connectSocket(url, "/socket.io", "websocket"));
            sockets.push(await connectSocket(url, "/ws/socket.io", "polling"));

            const res = await request(url).get("/metrics").expect(200);
            expect(res.text).to.include('quickbox_ws_socket_connections{path="/socket.io",transport="websocket"} 1\n');
            expect(res.text).to.include('quickbox_ws_socket_connections{path="/ws/socket.io",transport="polling"} 1\n');
            expect(res.text).to.include('quickbox_ws_socket_connections{path="/socket.io",transport="polling"} 0\n');
            expect(res.text).to.include('quickbox_ws_socket_connections_total{path="/socket.io"} 1\n');
            expect(res.text).to.include('quickbox_ws_socket_connections_total{path="/ws/socket.io"} 1\n');
        } finally {
            for (const socket of sockets) {socket.close();}
            await new Promise<void>((resolve, reject) => {
                server.close((error) => { if (error) {reject(error);} else {resolve();} });
                server.closeAllConnections();
            });
        }
    });
});
