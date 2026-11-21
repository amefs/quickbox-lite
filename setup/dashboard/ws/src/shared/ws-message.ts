// SPDX-License-Identifier: GPL-3.0-or-later

import type { WsPushMode } from "./bootstrap-contract";
import { OUTPUT_LOG_URL, normalizeBandwidthPage, type BandwidthPage } from "./widget-streams";

export interface WidgetArgs {
    page?: string;
    offset?: number;
    length?: number;
    epoch?: string;
}

interface WidgetRoute {
    key: string;
    url: string;
}

export interface WsWidgetRequest extends WidgetRoute {
    type: "request";
    requestId: string;
    args?: WidgetArgs;
}

interface WidgetResult extends WidgetRoute {
    success: boolean;
    message: string;
    response: unknown;
}

export interface WsWidgetReply extends WidgetResult {
    type: "reply";
    requestId: string;
}

export interface WsWidgetPush extends WidgetResult {
    type: "push";
    args?: WidgetArgs;
    stale?: true;
}

export interface WsProtocolError {
    type: "protocol-error";
    message: string;
}

export type WsWidgetResponse = WsWidgetReply | WsWidgetPush;
export type WsMessageEnvelope = WsWidgetResponse | WsProtocolError;

export interface WsSubscribeOptions {
    mode?: WsPushMode;
    bandwidthPage?: BandwidthPage;
    hidden?: boolean;
}

export interface WsExecResult {
    cmd: string;
    success: boolean;
    message: string;
    stdout: string;
    stderr: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
    value !== null && typeof value === "object" && !Array.isArray(value);

const isRequestId = (value: unknown): value is string => typeof value === "string" && value.length > 0;

function isWidgetArgs(args: unknown): args is WidgetArgs {
    return isRecord(args) &&
        (args.page === undefined || typeof args.page === "string") &&
        (args.offset === undefined || Number.isSafeInteger(args.offset)) &&
        (args.length === undefined || Number.isSafeInteger(args.length)) &&
        (args.epoch === undefined || typeof args.epoch === "string");
}

export function isWsWidgetRequest(value: unknown): value is WsWidgetRequest {
    return isRecord(value) && value.type === "request" &&
        typeof value.key === "string" && typeof value.url === "string" &&
        isRequestId(value.requestId) && (value.args === undefined || isWidgetArgs(value.args));
}

export interface LegacySshOutputRequest {
    key: "SSH_OUTPUT";
    url: string;
    requestId?: string;
    args: WidgetArgs;
}

function parseIntegerParam(value: string | null): number | undefined {
    if (!value) {
        return undefined;
    }
    const parsed = Number.parseInt(value, 10);
    return Number.isSafeInteger(parsed) ? parsed : undefined;
}

export function parseOutputLogQuery(url: string): WidgetArgs | null {
    try {
        const parsed = url.toLowerCase().startsWith("http")
            ? new URL(url)
            : new URL(url, "http://localhost");
        if (parsed.pathname !== OUTPUT_LOG_URL) {
            return null;
        }
        const offset = parseIntegerParam(parsed.searchParams.get("offset"));
        const length = parseIntegerParam(parsed.searchParams.get("length"));
        const epoch = parsed.searchParams.get("epoch") ?? undefined;
        return {
            ...(offset !== undefined ? { offset } : {}),
            ...(length !== undefined ? { length } : {}),
            ...(epoch !== undefined ? { epoch } : {}),
        };
    } catch {
        return null;
    }
}

export function parseLegacySshOutputRequest(value: unknown): LegacySshOutputRequest | null {
    if (!isRecord(value) || value.type !== undefined || value.key !== "SSH_OUTPUT" || typeof value.url !== "string") {
        return null;
    }
    if (value.requestId !== undefined && typeof value.requestId !== "string") {
        return null;
    }
    const args = parseOutputLogQuery(value.url);
    if (!args) {
        return null;
    }
    return {
        key: "SSH_OUTPUT",
        url: value.url,
        ...(value.requestId !== undefined ? { requestId: value.requestId } : {}),
        args,
    };
}

export function isWsMessageEnvelope(value: unknown): value is WsMessageEnvelope {
    if (!isRecord(value) || typeof value.message !== "string") {
        return false;
    }
    if (value.type === "protocol-error") {
        return true;
    }
    if (typeof value.key !== "string" || typeof value.url !== "string" || typeof value.success !== "boolean") {
        return false;
    }
    switch (value.type) {
        case "reply":
            return isRequestId(value.requestId);
        case "push":
            return (value.args === undefined || isWidgetArgs(value.args)) && (value.stale === undefined || value.stale === true);
        default:
            return false;
    }
}

export function parseWsMessageEnvelope(value: unknown): WsMessageEnvelope | null {
    if (isWsMessageEnvelope(value)) {
        return value;
    }
    if (!isRecord(value) || value.type !== undefined || value.key !== "SSH_OUTPUT" ||
        typeof value.url !== "string" || typeof value.success !== "boolean" || typeof value.message !== "string") {
        return null;
    }
    if (value.requestId !== undefined && typeof value.requestId !== "string") {
        return null;
    }
    return {
        type: "reply",
        key: "SSH_OUTPUT",
        url: value.url,
        requestId: value.requestId ?? "",
        success: value.success,
        message: value.message,
        response: value.response,
    };
}

export function parseWsSubscribeOptions(value: unknown): WsSubscribeOptions {
    if (!isRecord(value)) {
        return {};
    }
    return {
        ...(value.mode === "poll" || value.mode === "push" ? { mode: value.mode } : {}),
        ...(typeof value.bandwidthPage === "string" ? { bandwidthPage: normalizeBandwidthPage(value.bandwidthPage) } : {}),
        ...(typeof value.hidden === "boolean" ? { hidden: value.hidden } : {}),
    };
}

export function isWsExecResult(value: unknown): value is WsExecResult {
    return isRecord(value) &&
        typeof value.cmd === "string" &&
        typeof value.success === "boolean" &&
        typeof value.message === "string" &&
        typeof value.stdout === "string" &&
        typeof value.stderr === "string";
}
