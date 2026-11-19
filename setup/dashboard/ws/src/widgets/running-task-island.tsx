// SPDX-License-Identifier: GPL-3.0-or-later

import React from "react";

import type { RunningTaskData } from "../shared/running-task-contract";

export function RunningTaskIsland({ data }: { data: RunningTaskData | null }) {
    if (!data || !data.active) {
        return null;
    }

    return (
        <div
            className="alert alert-warning qb-running-task"
            role="status"
            data-task={data.kind}
            data-operation={data.operation}
        >
            <span className="qb-running-task-icon" aria-hidden="true" />
            <span className="qb-running-task-text">{data.text}</span>
            <span className="qb-running-task-actions">
                <button
                    type="button"
                    className="btn btn-xs btn-default"
                    data-qb-system-response=""
                >
                    {data.viewLogLabel}
                </button>
                <button
                    type="button"
                    className="btn btn-xs btn-danger"
                    data-task-abort=""
                    data-confirm={data.abortConfirm}
                >
                    {data.abortLabel}
                </button>
            </span>
        </div>
    );
}
