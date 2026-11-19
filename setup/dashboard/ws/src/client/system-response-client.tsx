// SPDX-License-Identifier: GPL-3.0-or-later

import React, { useSyncExternalStore } from "react";
import { createRoot } from "react-dom/client";
import { createCache, StyleProvider } from "@ant-design/cssinjs";

import type { SystemResponseBridge } from "../shared/system-response-contract";
import { SystemResponseModal, type SystemResponseSnapshot } from "../widgets/system-response-modal";

interface AnsiUpRenderer {
    ansi_to_html: (value: string) => string;
}

declare global {
    interface Window {
        quickboxSystemResponseIsland?: SystemResponseBridge;
        AnsiUp?: new () => AnsiUpRenderer;
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

function escapeHtml(value: string) {
    return value.replace(/[&<>"']/g, (character) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
    })[character] ?? character);
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
    let snapshot: SystemResponseSnapshot = { open: false, outputHtml: "", alertHtml: null };
    let rawContent = "";
    let endOffset = -1;
    let epoch: string | undefined;
    let ansi: AnsiUpRenderer | undefined;
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
        if (!window.AnsiUp) {
            outputHtml = escapeHtml(rawContent);
        } else if (replaced || !ansi) {
            ansi = new window.AnsiUp();
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
            snapshot = { ...snapshot, open: true, outputHtml, alertHtml: null };
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
        showAlert: (message) => {
            snapshot = { ...snapshot, alertHtml: message };
            publish();
        },
        closeAlert: () => {
            if (snapshot.alertHtml === null) {return;}
            snapshot = { ...snapshot, alertHtml: null };
            publish();
        },
    };
    return { bridge, getSnapshot, subscribe };
}

const runtime = window.quickboxRuntime;
const mount = document.getElementById("quickbox-system-response-root");
if (runtime && mount) {
    const clientRuntime = runtime;
    const store = createStore();
    window.quickboxSystemResponseIsland = store.bridge;
    const cache = createCache();
    const root = createRoot(mount);
    function ClientSystemResponse() {
        const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
        return (
            <SystemResponseModal
                snapshot={snapshot}
                labels={{
                    title: clientRuntime.messages.systemResponse,
                    closeRefresh: clientRuntime.messages.closeRefresh,
                    close: clientRuntime.messages.close,
                    ok: "OK",
                }}
                onClose={store.bridge.close}
                onCloseRefresh={() => { store.bridge.close(); window.location.reload(); }}
                onCloseAlert={store.bridge.closeAlert}
            />
        );
    }
    root.render(<StyleProvider cache={cache}><ClientSystemResponse /></StyleProvider>);
}
