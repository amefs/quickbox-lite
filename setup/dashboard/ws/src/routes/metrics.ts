// SPDX-License-Identifier: GPL-3.0-or-later

import type { RequestHandler } from "express";
import type { Server } from "socket.io";

import { GATEWAY_HEADER } from "../auth";
import { getServiceCollectorMetrics } from "../services/service/state";
import { getSamplerMetrics } from "../socket/push";

const CONTENT_TYPE = "text/plain; version=0.0.4; charset=utf-8";
const PROCESS_START_TIME_SECONDS = Date.now() / 1000 - process.uptime();
const TRANSPORTS = ["polling", "websocket"] as const;
const COLLECTOR_STATES = ["unknown", "ok", "degraded", "unavailable"] as const;
const LOOPBACK_ADDRESSES = new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1"]);
const PROXY_HEADERS = ["forwarded", "x-forwarded-for", "x-forwarded-host", "x-forwarded-proto", "x-real-ip", GATEWAY_HEADER];

interface Sample {
    value: number;
    labels?: Record<string, string>;
}

function renderLabels(labels: Record<string, string>): string {
    return `{${Object.entries(labels).map(([key, value]) => {
        const escaped = value.replaceAll("\\", "\\\\").replaceAll("\n", "\\n").replaceAll('"', '\\"');
        return `${key}="${escaped}"`;
    }).join(",")}}`;
}

export function createMetricsHandler(socketServers: Server[], isHealthy: () => boolean): RequestHandler {
    const readConnections = socketServers.map((server) => {
        let total = 0;
        server.on("connection", () => { total += 1; });
        return () => {
            const active = { polling: 0, websocket: 0 };
            for (const socket of server.sockets.sockets.values()) {
                const name = socket.conn.transport.name;
                if (name === "polling" || name === "websocket") {active[name] += 1;}
            }
            return { path: server.path(), active, total };
        };
    });

    return (req, res) => {
        if (!LOOPBACK_ADDRESSES.has(req.socket.remoteAddress ?? "") ||
            PROXY_HEADERS.some((header) => Object.hasOwn(req.headers, header))) {
            res.status(403).send("Forbidden");
            return;
        }

        const lines: string[] = [];
        const metric = (name: string, help: string, type: "counter" | "gauge", samples: Sample[]) => {
            const fullName = `quickbox_ws_${name}`;
            lines.push(`# HELP ${fullName} ${help}`, `# TYPE ${fullName} ${type}`);
            for (const { value, labels } of samples) {
                lines.push(`${fullName}${labels ? renderLabels(labels) : ""} ${value}`);
            }
        };
        const gauge = (name: string, help: string, value: number) => {
            metric(name, help, "gauge", [{ value }]);
        };

        gauge("healthy", "Whether the WS process is serving without a fatal error.", Number(isHealthy()));
        gauge("process_start_time_seconds", "Start time of the WS process in Unix seconds.", PROCESS_START_TIME_SECONDS);
        gauge("process_uptime_seconds", "Running time of the WS process in seconds.", process.uptime());
        const memory = process.memoryUsage();
        gauge("process_resident_memory_bytes", "Resident memory used by the WS process in bytes.", memory.rss);
        gauge("process_heap_used_bytes", "V8 heap memory used by the WS process in bytes.", memory.heapUsed);
        const cpu = process.cpuUsage();
        metric("process_cpu_seconds_total", "User and system CPU time consumed by the WS process in seconds.", "counter", [
            { value: (cpu.user + cpu.system) / 1e6 },
        ]);

        const connections = readConnections.map((read) => read());
        metric("socket_connections", "Active Socket.IO connections per path and transport.", "gauge",
            connections.flatMap(({ path, active }) => TRANSPORTS.map((transport) => ({
                labels: { path, transport }, value: active[transport],
            }))));
        metric("socket_connections_total", "Accepted Socket.IO connections per path since process start.", "counter",
            connections.map(({ path, total }) => ({ labels: { path }, value: total })));

        const samplers = getSamplerMetrics();
        metric("push_samplers", "Shared push samplers with active subscribers.", "gauge",
            samplers.map(({ stream, active }) => ({ labels: { stream }, value: active })));
        metric("push_samplers_in_flight", "Shared push samplers currently collecting, including unfinished timed-out samples.", "gauge",
            samplers.map(({ stream, inFlight }) => ({ labels: { stream }, value: inFlight })));
        metric("push_samplers_failed", "Shared push samplers whose latest attempt failed or timed out.", "gauge",
            samplers.map(({ stream, failed }) => ({ labels: { stream }, value: failed })));
        metric("push_samples_total", "Shared push sampling outcomes since process start.", "counter",
            samplers.flatMap(({ stream, outcomes }) => Object.entries(outcomes).map(([result, value]) => ({
                labels: { stream, result }, value,
            }))));
        metric("push_last_success_timestamp_seconds", "Unix time of the latest successful push sample, or zero if none.", "gauge",
            samplers.map(({ stream, lastSuccessAt }) => ({ labels: { stream }, value: lastSuccessAt / 1000 })));

        const collectors = getServiceCollectorMetrics();
        metric("service_collector_status", "Cached status of each service collector, with one active state.", "gauge",
            collectors.flatMap(({ collector, status }) => COLLECTOR_STATES.map((state) => ({
                labels: { collector, state }, value: Number(status === state),
            }))));
        metric("service_collector_last_refresh_timestamp_seconds", "Unix time of the current service collector snapshot, or zero if none.", "gauge",
            collectors.map(({ collector, lastRefreshAt }) => ({ labels: { collector }, value: lastRefreshAt / 1000 })));

        res.set("Content-Type", CONTENT_TYPE).set("Cache-Control", "no-store").send(`${lines.join("\n")}\n`);
    };
}
