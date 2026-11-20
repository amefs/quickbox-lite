// SPDX-License-Identifier: GPL-3.0-or-later

export interface SystemResponseAlert {
    message: string;
    command?: string;
    output?: string;
    outputIsAnsi?: boolean;
}

export interface SystemResponseBridge {
    open: () => void;
    close: () => void;
    isOpen: () => boolean;
    getOutputCursor: () => { end: number; epoch?: string };
    onMessage: (value: unknown) => boolean;
    showAlert: (alert: string | SystemResponseAlert) => void;
    closeAlert: () => void;
    notifyWarning: (title: string, description: string) => void;
}
