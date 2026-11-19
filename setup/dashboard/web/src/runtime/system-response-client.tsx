// SPDX-License-Identifier: GPL-3.0-or-later

import React, { useSyncExternalStore } from "react";
import { useTranslation } from "react-i18next";
import { notification } from "antd";
import { AnsiUp } from "ansi_up";

import type { DashboardBootstrapPayload } from "../../../ws/src/shared/bootstrap-contract";
import type { SystemResponseBridge } from "../../../ws/src/shared/system-response-contract";
import { SystemResponseModal, type SystemResponseSnapshot } from "../components/system-response-modal";
import { useDashboardTheme } from "./theme-store";

declare global {
    interface Window {
        quickboxSystemResponseIsland?: SystemResponseBridge;
    }
}

const MAX_OUTPUT_LENGTH = 1024 * 1024;

interface OutputChunk {
    content: string;
    start: number;
    end: number;
    size: number;
    epoch: string;
}

function parseOutputChunk(value: unknown): OutputChunk | null {
    if (value === null || typeof value !== "object" || Array.isArray(value) ||
        !("content" in value) || !("start" in value) || !("end" in value) || !("size" in value) || !("epoch" in value)) {
        return null;
    }
    if (typeof value.content !== "string" || typeof value.start !== "number" ||
        typeof value.end !== "number" || typeof value.size !== "number" || typeof value.epoch !== "string") {
        return null;
    }
    return value as OutputChunk;
}

function createStore() {
    let snapshot: SystemResponseSnapshot = { open: false, outputHtml: "", alert: null };
    let rawContent = "";
    let endOffset = -1;
    let epoch: string | undefined;
    let ansi: AnsiUp | undefined;
    let outputHtml = "";
    const listeners = new Set<() => void>();
    const publish = () => { listeners.forEach((listener) => { listener(); }); };
    const subscribe = (listener: () => void) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
    };
    const getSnapshot = () => snapshot;

    const updateHtml = (nextChunk: string, replaced: boolean) => {
        if (rawContent.length > MAX_OUTPUT_LENGTH) {
            rawContent = rawContent.slice(-MAX_OUTPUT_LENGTH);
            replaced = true;
        }
        if (replaced || !ansi) {
            ansi = new AnsiUp();
            outputHtml = ansi.ansi_to_html(rawContent);
        } else if (nextChunk) {
            outputHtml += ansi.ansi_to_html(nextChunk);
        }
    };

    const onMessage = (value: unknown) => {
        let nextChunk = "";
        let replaced = false;
        const response = parseOutputChunk(value);
        if (response) {
            const previousEnd = endOffset;
            if (previousEnd < 0 || response.epoch !== epoch || response.end < previousEnd || response.start > previousEnd) {
                rawContent = response.content;
                endOffset = response.end;
                epoch = response.epoch;
                replaced = true;
            } else if (response.end > previousEnd && response.content) {
                const overlap = Math.max(0, previousEnd - response.start);
                nextChunk = overlap > 0 ? response.content.slice(overlap) : response.content;
                rawContent += nextChunk;
                endOffset = response.end;
            }
        } else {
            rawContent = typeof value === "string" ? value : "";
            endOffset = -1;
            epoch = undefined;
            ansi = undefined;
            replaced = true;
        }
        updateHtml(nextChunk, replaced);
        if (nextChunk || replaced) {
            snapshot = { ...snapshot, outputHtml };
            publish();
        }
        return true;
    };

    const resetOutput = () => {
        rawContent = "";
        endOffset = -1;
        epoch = undefined;
        ansi = undefined;
        outputHtml = "";
    };

    const bridge: SystemResponseBridge = {
        open: () => {
            resetOutput();
            snapshot = { ...snapshot, open: true, outputHtml, alert: null };
            publish();
        },
        close: () => {
            if (!snapshot.open) {return;}
            resetOutput();
            snapshot = { ...snapshot, open: false, outputHtml };
            publish();
        },
        isOpen: () => snapshot.open,
        getOutputCursor: () => ({ end: endOffset, ...(epoch === undefined ? {} : { epoch }) }),
        onMessage,
        showAlert: (alertInput) => {
            const alert = typeof alertInput === "string"
                ? { message: alertInput }
                : {
                    ...alertInput,
                    ...(alertInput.outputIsAnsi && alertInput.output
                        ? { outputHtml: new AnsiUp().ansi_to_html(alertInput.output) }
                        : {}),
                };
            snapshot = { ...snapshot, alert };
            publish();
        },
        closeAlert: () => {
            if (snapshot.alert === null) {return;}
            snapshot = { ...snapshot, alert: null };
            publish();
        },
        notifyWarning: (title, description) => {
            notification.warning({ title, description });
        },
    };
    return { bridge, getSnapshot, subscribe };
}

const systemResponseStore = createStore();

export function registerSystemResponseIsland() {
    window.quickboxSystemResponseIsland = systemResponseStore.bridge;
}

export function SystemResponseSlot({ bootstrap }: { bootstrap: DashboardBootstrapPayload }) {
    const { t } = useTranslation();
    registerSystemResponseIsland();
    const snapshot = useSyncExternalStore(
        systemResponseStore.subscribe,
        systemResponseStore.getSnapshot,
        systemResponseStore.getSnapshot,
    );
    const activeTheme = useDashboardTheme(bootstrap.serviceTheme);
    return (
        <SystemResponseModal
            snapshot={snapshot}
            theme={activeTheme}
            labels={{
                title: t("SYSTEM_RESPONSE_TITLE"),
                closeRefresh: t("CLOSE_REFRESH"),
                close: t("CLOSE"),
                ok: "OK",
            }}
            onClose={systemResponseStore.bridge.close}
            onCloseRefresh={() => { systemResponseStore.bridge.close(); window.location.reload(); }}
            onCloseAlert={systemResponseStore.bridge.closeAlert}
        />
    );
}
