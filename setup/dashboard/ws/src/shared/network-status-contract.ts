// SPDX-License-Identifier: GPL-3.0-or-later

export interface NetworkInterfaceCounters {
    rx_bytes: number;
    tx_bytes: number;
}

export interface NetworkSnapshot {
    net: Record<string, NetworkInterfaceCounters>;
    ts: number;
}

export interface NetworkRate {
    rx: string;
    tx: string;
}

export interface NetworkStatusBridge {
    onInterfaces: (interfaces: unknown) => boolean;
    onMessage: (data: unknown) => boolean;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
    value !== null && typeof value === "object" && !Array.isArray(value);

const isFiniteNumber = (value: unknown): value is number =>
    typeof value === "number" && Number.isFinite(value);

export function isNetworkInterfaces(value: unknown): value is string[] {
    return Array.isArray(value) && value.every((iface) => typeof iface === "string");
}

export function isNetworkSnapshot(value: unknown): value is NetworkSnapshot {
    if (!isRecord(value) || Object.keys(value).length !== 2 || !isRecord(value.net) ||
        !isFiniteNumber(value.ts)) {
        return false;
    }
    return Object.values(value.net).every((counter) =>
        isRecord(counter) && Object.keys(counter).length === 2 &&
        isFiniteNumber(counter.rx_bytes) && isFiniteNumber(counter.tx_bytes),
    );
}
