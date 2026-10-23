// SPDX-License-Identifier: GPL-3.0-or-later

import { timingSafeEqual } from "crypto";
import { readFileSync } from "fs";
import type { IncomingHttpHeaders, IncomingMessage } from "http";
import type { NextFunction, Request, Response } from "express";

export const GATEWAY_HEADER = "x-quickbox-gateway";

/** Root managed secret location, see qbEnsureWsGateway. */
const DEFAULT_SECRET_FILE = "/etc/quickbox/ws.secret";
/** Pre-migration location, still readable so upgrades keep working mid-flight. */
const LEGACY_SECRET_FILE = "/srv/dashboard/db/ws.secret";
const MIN_SECRET_LENGTH = 16;

/**
 * Last successfully loaded secret. The secret is read on demand (so a rotated
 * file is picked up without a restart), but a failed read must never degrade
 * into "no authentication": we keep using the last known value instead.
 */
let cachedSecret = "";

function isProduction(): boolean {
    return process.env.NODE_ENV === "production";
}

export function isAuthDisabled(): boolean {
    return process.env.QUICKBOX_WS_AUTH === "0";
}

function headerValue(headers: IncomingHttpHeaders, name: string): string {
    const value = headers[name];
    if (Array.isArray(value)) {
        return value[0] ?? "";
    }
    return value ?? "";
}

function configuredSecretFiles(): string[] {
    const configured = process.env.QUICKBOX_WS_GATEWAY_SECRET_FILE?.trim();
    if (configured) {
        return [configured];
    }
    return [DEFAULT_SECRET_FILE, LEGACY_SECRET_FILE];
}

export interface GatewaySecretState {
    secret: string;
    error?: string;
}

export function readGatewaySecret(): GatewaySecretState {
    const fromEnv = process.env.QUICKBOX_WS_GATEWAY_SECRET;
    if (typeof fromEnv === "string" && fromEnv.trim() !== "") {
        cachedSecret = fromEnv.trim();
        return { secret: cachedSecret };
    }

    const attempted: string[] = [];
    for (const secretFile of configuredSecretFiles()) {
        attempted.push(secretFile);
        try {
            const value = readFileSync(secretFile, "utf8").trim();
            if (value !== "") {
                cachedSecret = value;
                return { secret: value };
            }
        } catch {
            continue;
        }
    }

    return {
        secret: cachedSecret,
        error: `gateway secret is missing, empty or unreadable (${attempted.join(", ")})`,
    };
}

export function getGatewaySecret(): string {
    return readGatewaySecret().secret;
}

export function resetGatewaySecretCache(): void {
    cachedSecret = "";
}

export function validateProductionAuth(): string | null {
    if (!isProduction()) {
        return null;
    }
    if (isAuthDisabled()) {
        return "QUICKBOX_WS_AUTH=0 is not allowed while NODE_ENV=production";
    }
    const { secret, error } = readGatewaySecret();
    if (secret === "") {
        return error ?? "gateway secret is not configured";
    }
    if (secret.length < MIN_SECRET_LENGTH) {
        return `gateway secret is too short (expected at least ${MIN_SECRET_LENGTH} characters)`;
    }
    return null;
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
    if (isProduction()) {
        return true;
    }
    if (isAuthDisabled()) {
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

function normalizeProtocol(protocol: string | undefined): string | null {
    const value = (protocol ?? "").trim().toLowerCase();
    if (value === "https" || value === "https:") {
        return "https:";
    }
    if (value === "http" || value === "http:") {
        return "http:";
    }
    return value === "" ? "http:" : null;
}

function defaultPort(protocol: string): string {
    return protocol === "https:" ? "443" : "80";
}

/** URL.port is empty for the protocol default, so normalize to compare. */
function effectivePort(url: URL): string {
    return url.port !== "" ? url.port : defaultPort(normalizeProtocol(url.protocol) ?? "http:");
}

function parseAuthority(authority: string, protocol: string): URL | null {
    const trimmed = authority.trim();
    if (trimmed === "") {
        return null;
    }
    // An authority must not contain a path, query, fragment or userinfo; those
    // would let a crafted Host header smuggle a different host into the check.
    if (/[/\\?#@]/.test(trimmed)) {
        return null;
    }
    try {
        // Supports "host", "host:port", "[::1]:port" and keeps IPv6 brackets.
        const parsed = new URL(`${normalizeProtocol(protocol) ?? "http:"}//${trimmed}`);
        return parsed;
    } catch {
        return null;
    }
}

function parseOrigin(origin: string): URL | null {
    try {
        const parsed = new URL(origin);
        if (parsed.hostname === "" || normalizeProtocol(parsed.protocol) === null) {
            return null;
        }
        return parsed;
    } catch {
        return null;
    }
}

function parseAllowedOrigins(): string[] {
    const raw = process.env.QUICKBOX_WS_ALLOWED_ORIGINS ?? "";
    return raw
        .split(",")
        .map((entry) => entry.trim().toLowerCase())
        .filter((entry) => entry !== "");
}

const warnedHostOnlyEntries = new Set<string>();

function warnHostOnlyEntry(entry: string): void {
    if (warnedHostOnlyEntries.has(entry)) {
        return;
    }
    warnedHostOnlyEntries.add(entry);
    console.warn(
        `[quickbox-ws] QUICKBOX_WS_ALLOWED_ORIGINS entry "${entry}" has no scheme and matches any port/protocol of that host; use a full origin instead.`,
    );
}

/**
 * Full origins are compared exactly (protocol + host + port). Host-only entries
 * are still accepted for backwards compatibility but are reported as deprecated.
 */
function matchesAllowedOrigin(parsed: URL): boolean {
    const originProtocol = normalizeProtocol(parsed.protocol);
    if (originProtocol === null) {
        return false;
    }
    const originHost = parsed.hostname.toLowerCase();
    const originPort = effectivePort(parsed);

    return parseAllowedOrigins().some((entry) => {
        if (entry.includes("://")) {
            let allowed: URL;
            try {
                allowed = new URL(entry);
            } catch {
                return false;
            }
            return (
                normalizeProtocol(allowed.protocol) === originProtocol &&
                allowed.hostname.toLowerCase() === originHost &&
                effectivePort(allowed) === originPort
            );
        }
        warnHostOnlyEntry(entry);
        const allowedAuthority = parseAuthority(entry, originProtocol);
        if (allowedAuthority === null) {
            return entry === originHost;
        }
        return allowedAuthority.hostname.toLowerCase() === originHost;
    });
}

export function isAllowedOrigin(origin: string | undefined, hostHeader: string | undefined, protocol = "http"): boolean {
    if (origin === undefined || origin === "") {
        return true;
    }
    const parsed = parseOrigin(origin);
    if (!parsed) {
        return false;
    }
    const expectedProtocol = normalizeProtocol(protocol);
    if (expectedProtocol === null) {
        return false;
    }
    const requestUrl = parseAuthority(hostHeader ?? "", expectedProtocol);
    if (normalizeProtocol(parsed.protocol) === expectedProtocol && requestUrl !== null &&
        parsed.hostname.toLowerCase() === requestUrl.hostname.toLowerCase() &&
        effectivePort(parsed) === effectivePort(requestUrl)) {
        return true;
    }
    return matchesAllowedOrigin(parsed);
}

/**
 * Effective protocol of the client request. X-Forwarded-Proto is only trusted
 * when the request comes from the loopback proxy, which is the only thing that
 * can reach the Node port by default.
 */
export function requestProtocol(req: IncomingMessage): string {
    const socket = req.socket as (IncomingMessage["socket"] & { encrypted?: boolean }) | undefined;
    const direct = socket?.encrypted === true ? "https" : "http";
    const remote = socket?.remoteAddress ?? "";
    const fromLoopback = remote === "127.0.0.1" || remote === "::1" || remote === "::ffff:127.0.0.1";
    if (!fromLoopback) {
        return direct;
    }
    const forwarded = headerValue(req.headers, "x-forwarded-proto")
        .split(",")[0]
        .trim()
        .toLowerCase();
    if (forwarded === "https" || forwarded === "http") {
        return forwarded;
    }
    return direct;
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
        if (!isAllowedOrigin(origin === "" ? undefined : origin, host === "" ? undefined : host, requestProtocol(req))) {
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

export function assertProductionAuth(): string | null {
    const problem = validateProductionAuth();
    if (problem !== null) {
        console.error(`[quickbox-ws] refusing to start: ${problem}`);
    }
    return problem;
}
