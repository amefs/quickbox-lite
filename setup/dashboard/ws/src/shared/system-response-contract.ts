// SPDX-License-Identifier: GPL-3.0-or-later

export interface SystemResponseBridge {
    open: () => void;
    close: () => void;
    isOpen: () => boolean;
    getOutputCursor: () => { end: number; epoch?: string };
    onMessage: (value: unknown) => boolean;
    showAlert: (message: string) => void;
    closeAlert: () => void;
}

export interface SystemResponseLabels {
    title: string;
    closeRefresh: string;
    close: string;
    ok: string;
}
