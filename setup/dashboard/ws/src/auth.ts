// SPDX-License-Identifier: GPL-3.0-or-later

import { timingSafeEqual } from "crypto";
import { existsSync, readFileSync } from "fs";
import type { IncomingHttpHeaders, IncomingMessage } from "http";
import type { NextFunction, Request, Response } from "express";

export const GATEWAY_HEADER = "x-quickbox-gateway";
const DEFAULT_SECRET_FILE = "/srv/dashboard/db/ws.secret";

function headerValue(headers: IncomingHttpHeaders, name: string): string {
    const value = headers[name];
    if (Array.isArray(value)) {
        return value[0] ?? "";
    }
    return value ?? "";
}

function readGatewaySecret(): string {
    const fromEnv = process.env.QUICKBOX_WS_GATEWAY_SECRET;
    if (typeof fromEnv === "string" && fromEnv.trim() !== "") {
        return fromEnv.trim();
    }
    const secretFile = process.env.QUICKBOX_WS_GATEWAY_SECRET_FILE ?? DEFAULT_SECRET_FILE;
    try {
        if (existsSync(secretFile)) {
            return readFileSync(secretFile, "utf8").trim();
        }
    } catch {
        // Missing or unreadable secret files are treated as "not configured".
    }
    return "";
}

export function getGatewaySecret(): string {
    return readGatewaySecret();
}

export function secretsEqual(left: string, right: string): boolean {
    const leftBuffer = Buffer.from(left);
    const rightBuffer = Buffer.from(right);
    if (leftBuffer.length === 0 || leftBuffer.length !== rightBuffer.length) {
        return false;
    }
    return timingSafeEqual(leftBuffer, rightBuffer);
}

export function shouldEnforceGateway(): boolean {
    if (process.env.QUICKBOX_WS_AUTH === "0") {
        return false;
    }
    if (process.env.NODE_ENV === "test" && !process.env.QUICKBOX_WS_GATEWAY_SECRET) {
        return false;
    }
    return getGatewaySecret() !== "";
}

export function shouldEnforceOrigin(): boolean {
    if (process.env.QUICKBOX_WS_ENFORCE_ORIGIN === "0") {
        return false;
    }
    return process.env.NODE_ENV !== "test" || process.env.QUICKBOX_WS_ENFORCE_ORIGIN === "1";
}

export function hasValidGateway(headers: IncomingHttpHeaders, secret = getGatewaySecret()): boolean {
    if (secret === "") {
        return false;
    }
    return secretsEqual(headerValue(headers, GATEWAY_HEADER), secret);
}

function parseAllowedOrigins(): string[] {
    const raw = process.env.QUICKBOX_WS_ALLOWED_ORIGINS ?? "";
    return raw
        .split(",")
        .map((entry) => entry.trim().toLowerCase())
        .filter((entry) => entry !== "");
}

export function isAllowedOrigin(origin: string | undefined, hostHeader: string | undefined): boolean {
    if (origin === undefined || origin === "") {
        return true;
    }
    let originHost: string;
    try {
        originHost = new URL(origin).hostname.toLowerCase();
    } catch {
        return false;
    }
    const requestHost = (hostHeader ?? "").split(":")[0].toLowerCase();
    if (requestHost !== "" && originHost === requestHost) {
        return true;
    }
    const originOrigin = origin.toLowerCase().replace(/\/$/, "");
    return parseAllowedOrigins().some((allowed) => {
        if (allowed === originOrigin) {
            return true;
        }
        try {
            return new URL(allowed).hostname.toLowerCase() === originHost;
        } catch {
            return allowed === originHost;
        }
    });
}

export interface HandshakeAuthResult {
    ok: boolean;
    error?: string;
}

export function authorizeHandshake(req: IncomingMessage): HandshakeAuthResult {
    if (shouldEnforceGateway() && !hasValidGateway(req.headers)) {
        return { ok: false, error: "unauthorized" };
    }
    if (shouldEnforceOrigin()) {
        const origin = headerValue(req.headers, "origin");
        const host = headerValue(req.headers, "host");
        if (!isAllowedOrigin(origin === "" ? undefined : origin, host === "" ? undefined : host)) {
            return { ok: false, error: "origin not allowed" };
        }
    }
    return { ok: true };
}

export function gatewayAuthMiddleware(req: Request, res: Response, next: NextFunction): void {
    if (!shouldEnforceGateway()) {
        next();
        return;
    }
    if (!hasValidGateway(req.headers)) {
        res.status(401).send("Unauthorized");
        return;
    }
    next();
}

export function warnIfGatewayMissing(): void {
    if (process.env.NODE_ENV === "production" && getGatewaySecret() === "") {
        console.warn("[quickbox-ws] gateway secret is not configured; direct access to the Node port is unauthenticated");
    }
}
