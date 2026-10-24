// SPDX-License-Identifier: GPL-3.0-or-later

import { readFileSync } from "fs";
import React from "react";
import ReactDOMServer from "react-dom/server";

import i18n from "../i18n";

const INSTALL_LOCK = "/install/.install.lock";

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

// qbUpdate takes the lock under its own name; "QuickBox is running" would not
// tell the user that the panel itself is being updated.
function taskLabel(title: string) {
    return title === "QuickBox" ? i18n.t("TASK_UPDATE_LABEL") : title;
}

/**
 * Banner for the operation that currently owns the log. Renders nothing when
 * the lock is absent, so the Dashboard can poll it as a normal widget.
 */
// eslint-disable-next-line @typescript-eslint/require-await
export async function runningTask(readTitle: () => string | null = readRunningTaskTitle) {
    const title = readTitle();
    // A title is written in the same step as the lock, so an empty one is a
    // half-written file rather than a task worth naming.
    if (title === null || title === "") {
        return "";
    }

    const isUpdate = title === "QuickBox";
    return ReactDOMServer.renderToString(
        <div className="alert alert-warning qb-running-task" role="status" data-task={isUpdate ? "update" : "package"}>
            <i className="fa fa-spinner fa-pulse qb-running-task-icon" aria-hidden="true"></i>
            <span className="qb-running-task-text">
                {i18n.t("TASK_RUNNING_TXT", { task: taskLabel(title) })}
            </span>
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
