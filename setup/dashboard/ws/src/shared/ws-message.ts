// SPDX-License-Identifier: GPL-3.0-or-later

export interface WsMessageEnvelope {
    key: string;
    requestId?: string;
    url: string;
    pathName: string;
    success: boolean;
    message: string;
    response: unknown;
    push?: boolean;
    stale?: boolean;
}

export function createWsMessageEnvelope(params: {
    key: string;
    url: string;
    pathName: string;
    success: boolean;
    message?: string;
    response: unknown;
    requestId?: string;
    push?: boolean;
    stale?: boolean;
}): WsMessageEnvelope {
    return {
        ...(params.push ? { push: true } : {}),
        ...(params.stale ? { stale: true } : {}),
        key: params.key,
        ...(params.requestId !== undefined ? { requestId: params.requestId } : {}),
        url: params.url,
        pathName: params.pathName,
        success: params.success,
        message: params.message ?? "",
        response: params.response,
    };
}

export function isWsMessageEnvelope(value: unknown): value is WsMessageEnvelope {
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
        return false;
    }
    const record = value as Record<string, unknown>;
    return typeof record.key === "string" &&
        typeof record.url === "string" &&
        typeof record.success === "boolean";
}
