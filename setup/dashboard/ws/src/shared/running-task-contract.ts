// SPDX-License-Identifier: GPL-3.0-or-later

export type RunningTaskOperation = "install" | "remove" | "update";

export interface RunningTaskData {
    active: boolean;
    kind: RunningTaskOperation | "package";
    operation: RunningTaskOperation | "";
    title?: string;
    text: string;
    viewLogLabel: string;
    abortLabel: string;
    abortConfirm: string;
}

export interface RunningTaskBridge {
    onMessage: (value: unknown) => boolean;
}

export function isRunningTaskData(value: unknown): value is RunningTaskData {
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
        return false;
    }
    const record = value as Record<string, unknown>;
    return typeof record.active === "boolean" &&
        (record.kind === "install" || record.kind === "remove" || record.kind === "update" || record.kind === "package") &&
        (record.operation === "" || record.operation === "install" || record.operation === "remove" || record.operation === "update") &&
        (record.title === undefined || typeof record.title === "string") &&
        typeof record.text === "string" &&
        typeof record.viewLogLabel === "string" &&
        typeof record.abortLabel === "string" &&
        typeof record.abortConfirm === "string";
}
