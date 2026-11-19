// SPDX-License-Identifier: GPL-3.0-or-later

export type RunningTaskOperation = "install" | "remove" | "update";

export interface RunningTaskData {
    active: boolean;
    kind: RunningTaskOperation | "package";
    operation: RunningTaskOperation | "";
    title?: string;
    text?: string;
    viewLogLabel?: string;
    abortLabel?: string;
    abortConfirm?: string;
}

export interface RunningTaskBridge {
    onMessage: (value: unknown) => boolean;
}

export function isRunningTaskData(value: unknown): value is RunningTaskData {
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
        return false;
    }
    const record = value as Record<string, unknown>;
    const optionalStrings = ["title", "text", "viewLogLabel", "abortLabel", "abortConfirm"];
    return typeof record.active === "boolean" &&
        ["install", "remove", "update", "package"].includes(record.kind as string) &&
        ["", "install", "remove", "update"].includes(record.operation as string) &&
        optionalStrings.every((key) => record[key] === undefined || typeof record[key] === "string");
}
