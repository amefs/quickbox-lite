// SPDX-License-Identifier: GPL-3.0-or-later

import { readdirSync, readFileSync } from "fs";
import React from "react";
import ReactDOMServer from "react-dom/server";

import i18n from "../i18n";

const INSTALL_LOCK = "/install/.install.lock";

export type RunningTaskOperation = "install" | "remove" | "update";

/**
 * Title of the operation that holds the install lock, or null when no
 * operation holds it. The lock is written by the lifecycle scripts and by
 * qbUpdate as their first step and holds the display name only.
 */
export function readRunningTaskTitle(): string | null {
    try {
        return readFileSync(INSTALL_LOCK, "utf8").trim();
    } catch {
        return null;
    }
}

// box launches these scripts as `bash /absolute/script/path`. Inspect that
// script argument only: an editor, reader or shell command can mention the same
// path without executing the operation.
const OPERATION_PATTERNS: readonly (readonly [RegExp, RunningTaskOperation])[] = [
    [/^\/usr\/local\/bin\/quickbox\/package\/install\/installpackage-[a-z0-9-]+$/, "install"],
    [/^\/usr\/local\/bin\/quickbox\/package\/remove\/removepackage-[a-z0-9-]+$/, "remove"],
    [/^\/usr\/local\/bin\/quickbox\/package\/update\/updatepackage-[a-z0-9-]+$/, "update"],
    [/^\/usr\/local\/bin\/quickbox\/system\/auxiliary\/install-BBR\.sh$/, "install"],
    [/^\/usr\/local\/bin\/quickbox\/system\/qbUpdate$/, "update"],
];

/**
 * Verb of the operation that currently holds the install lock, or null when it
 * cannot be identified or candidate scripts disagree. Callers fall back to a
 * generic label rather than letting process directory order choose the verb.
 */
export function detectRunningTaskOperation(
    readDir: (dir: string) => string[] = (dir) => readdirSync(dir),
    readCmdline: (pid: string) => string = (pid) => readFileSync(`/proc/${pid}/cmdline`, "utf8"),
): RunningTaskOperation | null {
    let entries: string[];
    try {
        entries = readDir("/proc");
    } catch {
        return null;
    }

    let detected: RunningTaskOperation | null = null;
    for (const entry of entries) {
        if (!/^[0-9]+$/.test(entry)) {
            continue;
        }
        let cmdline: string;
        try {
            cmdline = readCmdline(entry);
        } catch {
            // The process exited between the directory scan and this read.
            continue;
        }
        const [shell, script] = cmdline.split("\0");
        if (!/^(?:\/(?:usr\/)?bin\/)?bash$/.test(shell) || !script) {
            continue;
        }
        const operation = OPERATION_PATTERNS.find(([pattern]) => pattern.test(script))?.[1];
        if (!operation) {
            continue;
        }
        if (detected !== null && detected !== operation) {
            return null;
        }
        detected = operation;
    }
    return detected;
}

// qbUpdate takes the lock under its own name; "QuickBox is running" would not
// tell the user that the panel itself is being updated.
function taskLabel(title: string) {
    return title === "QuickBox" ? i18n.t("TASK_UPDATE_LABEL") : title;
}

const OPERATION_TEXT: Record<RunningTaskOperation, string> = {
    install: "TASK_INSTALL_TXT",
    remove: "TASK_UNINSTALL_TXT",
    update: "TASK_UPGRADE_TXT",
};

function taskText(title: string, operation: RunningTaskOperation | null) {
    // An update of QuickBox itself reads better with its own label than with
    // the generic "updating" wording.
    if (operation === null || title === "QuickBox") {
        return i18n.t("TASK_RUNNING_TXT", { task: taskLabel(title) });
    }
    return i18n.t(OPERATION_TEXT[operation], { task: title });
}

/**
 * Banner for the operation that currently owns the log. Renders nothing when
 * the lock is absent, so the Dashboard can poll it as a normal widget.
 */
// eslint-disable-next-line @typescript-eslint/require-await
export async function runningTask(
    readTitle: () => string | null = readRunningTaskTitle,
    detectOperation: () => RunningTaskOperation | null = detectRunningTaskOperation,
) {
    const title = readTitle();
    // A title is written in the same step as the lock, so an empty one is a
    // half-written file rather than a task worth naming.
    if (title === null || title === "") {
        return "";
    }

    const operation = detectOperation();
    const kind = operation ?? (title === "QuickBox" ? "update" : "package");
    return ReactDOMServer.renderToString(
        <div
            className="alert alert-warning qb-running-task"
            role="status"
            data-task={kind}
            data-operation={operation ?? ""}
        >
            <i className="fa fa-spinner fa-pulse qb-running-task-icon" aria-hidden="true"></i>
            <span className="qb-running-task-text">{taskText(title, operation)}</span>
            <span className="qb-running-task-actions">
                <button
                    type="button"
                    className="btn btn-xs btn-default"
                    data-toggle="modal"
                    data-target="#sysResponse"
                    data-sysresponse-mode="log-view"
                >
                    {i18n.t("VIEW_LOG")}
                </button>
                <button
                    type="button"
                    className="btn btn-xs btn-danger"
                    data-toggle="modal"
                    data-target="#taskAbortConfirm"
                >
                    {i18n.t("TASK_ABORT")}
                </button>
            </span>
        </div>,
    );
}
