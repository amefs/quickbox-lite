// SPDX-License-Identifier: GPL-3.0-or-later

import React, { useSyncExternalStore } from "react";
import { useTranslation } from "react-i18next";
import { notification } from "antd";
import { AnsiUp } from "ansi_up";

import type { DashboardBootstrapPayload } from "../../../ws/src/shared/bootstrap-contract";
import type { SystemResponseBridge } from "../../../ws/src/shared/system-response-contract";
import { SystemResponseModal, type SystemResponseSnapshot, type SystemLogBlock } from "../components/system-response-modal";
import { useDashboardTheme } from "./theme-store";

declare global {
    interface Window {
        quickboxSystemResponseIsland?: SystemResponseBridge;
    }
}

const MAX_OUTPUT_LENGTH = 1024 * 1024;
const OUTPUT_BLOCK_LENGTH = 4096;

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

function byteOffsetToStringIndex(value: string, byteOffset: number): number {
    let bytes = 0;
    let index = 0;
    for (const character of value) {
        if (bytes >= byteOffset) {
            break;
        }
        const codePoint = character.codePointAt(0) ?? 0;
        const characterBytes = codePoint <= 0x7f ? 1 : codePoint <= 0x7ff ? 2 : codePoint <= 0xffff ? 3 : 4;
        if (bytes + characterBytes > byteOffset) {
            break;
        }
        bytes += characterBytes;
        index += character.length;
    }
    return index;
}

function createStore() {
    let snapshot: SystemResponseSnapshot = { open: false, outputBlocks: [], alert: null };
    let endOffset = -1;
    let epoch: string | undefined;
    let ansi = new AnsiUp();
    let outputLength = 0;
    let blockId = 0;
    const listeners = new Set<() => void>();
    const publish = () => { listeners.forEach((listener) => { listener(); }); };
    const subscribe = (listener: () => void) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
    };
    const getSnapshot = () => snapshot;

    const appendOutput = (content: string, replace: boolean): SystemLogBlock[] => {
        const blocks = replace ? [] : [...snapshot.outputBlocks];
        if (replace) {
            outputLength = 0;
            ansi = new AnsiUp();
        }
        for (let start = 0; start < content.length;) {
            const tail = blocks.at(-1);
            const available = OUTPUT_BLOCK_LENGTH - (tail?.length ?? 0);
            const extendTail = tail && available >= 2;
            let end = Math.min(start + (extendTail ? available : OUTPUT_BLOCK_LENGTH), content.length);
            const last = content.charCodeAt(end - 1);
            if (end < content.length && last >= 0xd800 && last <= 0xdbff) {end -= 1;}
            const text = content.slice(start, end);
            const html = ansi.ansi_to_html(text);
            if (extendTail) {
                blocks[blocks.length - 1] = { id: tail.id, html: tail.html + html, length: tail.length + text.length };
            } else {
                blocks.push({ id: ++blockId, html, length: text.length });
            }
            outputLength += text.length;
            start = end;
        }
        let dropped = 0;
        while (outputLength > MAX_OUTPUT_LENGTH) {
            outputLength -= blocks[dropped++].length;
        }
        return blocks.slice(dropped);
    };

    const onMessage = (value: unknown) => {
        const response = parseOutputChunk(value);
        let content: string;
        let replaced = true;
        if (response) {
            const previousEnd = endOffset;
            replaced = previousEnd < 0 || response.epoch !== epoch || response.end < previousEnd || response.start > previousEnd;
            if (!replaced && (response.end === previousEnd || !response.content)) {return true;}
            const overlap = replaced ? 0 : Math.max(0, previousEnd - response.start);
            content = response.content.slice(byteOffsetToStringIndex(response.content, overlap));
            endOffset = response.end;
            epoch = response.epoch;
        } else {
            content = typeof value === "string" ? value : "";
            endOffset = -1;
            epoch = undefined;
        }
        snapshot = { ...snapshot, outputBlocks: appendOutput(content, replaced) };
        publish();
        return true;
    };

    const resetOutput = () => {
        endOffset = -1;
        epoch = undefined;
        ansi = new AnsiUp();
        outputLength = 0;
    };

    const bridge: SystemResponseBridge = {
        open: () => {
            resetOutput();
            snapshot = { ...snapshot, open: true, outputBlocks: [], alert: null };
            publish();
        },
        close: () => {
            if (!snapshot.open) {return;}
            resetOutput();
            snapshot = { ...snapshot, open: false, outputBlocks: [] };
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

export const systemResponseActions: SystemResponseBridge = systemResponseStore.bridge;

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
