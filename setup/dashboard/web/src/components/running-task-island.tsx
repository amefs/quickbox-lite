// SPDX-License-Identifier: GPL-3.0-or-later

import React from "react";
import { LoadingOutlined } from "@ant-design/icons";
import { useTranslation } from "react-i18next";

import type { RunningTaskData, RunningTaskOperation } from "../../../ws/src/shared/running-task-contract";
import { abortRunningTask, useCommandConnection } from "../runtime/dashboard-runtime-client";
import { systemResponseActions } from "../runtime/system-response-client";

const OPERATION_TEXT: Record<RunningTaskOperation, string> = {
    install: "TASK_INSTALL_TXT",
    remove: "TASK_UNINSTALL_TXT",
    update: "TASK_UPGRADE_TXT",
};

export function RunningTaskIsland({ data }: { data: RunningTaskData | null }) {
    const { t } = useTranslation();
    const commandsConnected = useCommandConnection();
    if (!data || !data.active) {
        return null;
    }

    const taskText = data.title !== undefined
        ? (data.operation === "" || data.title === "QuickBox"
            ? t("TASK_RUNNING_TXT", { task: data.title === "QuickBox" ? t("TASK_UPDATE_LABEL") : data.title })
            : t(OPERATION_TEXT[data.operation], { task: data.title }))
        : data.text;
    const viewLogLabel = t("VIEW_LOG");
    const abortLabel = t("TASK_ABORT");
    const abortConfirm = t("TASK_ABORT_CONFIRM_TXT").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

    return (
        <div
            className="alert alert-warning qb-running-task"
            role="status"
            data-task={data.kind}
            data-operation={data.operation}
        >
            <LoadingOutlined className="qb-running-task-icon" aria-hidden="true" />
            <span className="qb-running-task-text">{taskText}</span>
            <span className="qb-running-task-actions">
                <button
                    type="button"
                    className="btn btn-xs btn-default"
                    data-qb-system-response=""
                    onClick={() => { systemResponseActions.open(); }}
                >
                    {viewLogLabel}
                </button>
                <button
                    type="button"
                    className="btn btn-xs btn-danger"
                    disabled={!commandsConnected}
                    data-task-abort=""
                    data-confirm={abortConfirm}
                    onClick={() => { abortRunningTask(abortConfirm); }}
                >
                    {abortLabel}
                </button>
            </span>
        </div>
    );
}
