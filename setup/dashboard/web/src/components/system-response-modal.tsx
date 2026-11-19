// SPDX-License-Identifier: GPL-3.0-or-later

import React from "react";
import { Button, ConfigProvider, Modal } from "antd";

import type { SystemResponseAlert, SystemResponseLabels } from "../../../ws/src/shared/system-response-contract";
import type { DashboardTheme } from "../../../ws/src/shared/theme";
import { getAntdThemeConfig } from "../runtime/theme-store";

export interface SystemResponseAlertView extends SystemResponseAlert {
    outputHtml?: string;
}

export interface SystemResponseSnapshot {
    open: boolean;
    outputHtml: string;
    alert: SystemResponseAlertView | null;
}

export interface SystemResponseModalProps {
    snapshot: SystemResponseSnapshot;
    labels: SystemResponseLabels;
    theme?: DashboardTheme;
    onClose: () => void;
    onCloseRefresh: () => void;
    onCloseAlert: () => void;
}

export function SystemResponseModal({ snapshot, labels, theme = "defaulted", onClose, onCloseRefresh, onCloseAlert }: SystemResponseModalProps) {
    const outputRef = React.useRef<HTMLDivElement>(null);
    const outputScroll = React.useRef({ top: 0, height: 0, clientHeight: 0 });
    const previousOutput = React.useRef("");
    React.useLayoutEffect(() => {
        const output = outputRef.current;
        if (!snapshot.open) {
            outputScroll.current = { top: 0, height: 0, clientHeight: 0 };
            previousOutput.current = snapshot.outputHtml;
            return;
        }
        if (!output) {return;}
        if (previousOutput.current !== snapshot.outputHtml) {
            const previous = outputScroll.current;
            const distanceFromBottom = previous.height - previous.top - previous.clientHeight;
            output.scrollTop = previous.height === 0 || distanceFromBottom < 2 ? output.scrollHeight : previous.top;
            previousOutput.current = snapshot.outputHtml;
        }
        outputScroll.current = { top: output.scrollTop, height: output.scrollHeight, clientHeight: output.clientHeight };
    }, [snapshot.outputHtml, snapshot.open]);

    return (
        <ConfigProvider theme={getAntdThemeConfig(theme, { borderRadius: 4 })}>
            <Modal
                open={snapshot.open}
                title={labels.title}
                width={600}
                centered
                zIndex={2200}
                transitionName=""
                closable
                closeIcon={<span id="sysResponseDismiss" aria-label={labels.close}>&times;</span>}
                keyboard
                mask={{ closable: false }}
                onCancel={onClose}
                wrapProps={{ id: "sysResponse" }}
                classNames={{
                    wrapper: "qb-system-response-wrap",
                    container: "qb-system-response-content",
                    header: "qb-system-response-header",
                    title: "qb-system-response-title",
                    body: "ps qb-system-response-body",
                    footer: "qb-system-response-footer",
                }}
                styles={{
                    container: { background: "rgba(0, 0, 0, 0.6)", border: "2px solid rgba(0, 0, 0, 0.2)" },
                    header: { background: "rgba(0, 0, 0, 0.4)", border: 0 },
                    title: { color: "#fff", fontSize: 15, fontWeight: 600 },
                    body: { background: "rgba(0, 0, 0, 0.4)", padding: 16, overflow: "hidden" },
                    footer: { background: "rgba(0, 0, 0, 0.4)", border: 0 },
                }}
                footer={(
                    <Button
                        id="sysResponseCloseAction"
                        danger
                        size="small"
                        className="btn btn-xs btn-danger"
                        onClick={onCloseRefresh}
                    >
                        {labels.closeRefresh}
                    </Button>
                )}
            >
                <div id="sysPre" ref={outputRef} className="qb-system-response-output" style={{ height: "min(600px, calc(100vh - 220px))", overflowY: "auto" }} onScroll={(event) => {
                    const output = event.currentTarget;
                    outputScroll.current = { top: output.scrollTop, height: output.scrollHeight, clientHeight: output.clientHeight };
                }}>
                    <pre className="sysout"><span id="sshoutput" dangerouslySetInnerHTML={{ __html: snapshot.outputHtml }} /></pre>
                </div>
            </Modal>
            <Modal
                open={snapshot.alert !== null}
                title={labels.title}
                width={600}
                centered
                zIndex={2210}
                onCancel={onCloseAlert}
                onOk={onCloseAlert}
                wrapProps={{ id: "quickbox-alert-modal" }}
                classNames={{
                    wrapper: "qb-alert-modal-wrap",
                    container: "qb-alert-modal-content",
                    header: "qb-alert-modal-header",
                    title: "qb-alert-modal-title",
                }}
                footer={<Button type="primary" onClick={onCloseAlert}>{labels.ok}</Button>}
            >
                {snapshot.alert ? (
                    <>
                        <p className="qb-alert-message">{snapshot.alert.message}</p>
                        {snapshot.alert.command ? (
                            <code className="qb-alert-command">{snapshot.alert.command}</code>
                        ) : null}
                        {snapshot.alert.outputHtml || snapshot.alert.output ? (
                            <>
                                <hr className="qb-alert-divider" />
                                {snapshot.alert.outputHtml ? (
                                    <div className="exec-output qb-alert-output" dangerouslySetInnerHTML={{ __html: snapshot.alert.outputHtml }} />
                                ) : (
                                    <pre className="qb-alert-output">{snapshot.alert.output}</pre>
                                )}
                            </>
                        ) : null}
                    </>
                ) : null}
            </Modal>
        </ConfigProvider>
    );
}
