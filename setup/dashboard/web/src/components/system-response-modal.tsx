// SPDX-License-Identifier: GPL-3.0-or-later

import React from "react";
import { useTranslation } from "react-i18next";
import { Button, ConfigProvider, Modal } from "antd";

import type { SystemResponseAlert } from "../../../ws/src/shared/system-response-contract";
import type { DashboardTheme } from "../../../ws/src/shared/theme";
import { getAntdThemeConfig } from "../runtime/theme-store";

export interface SystemResponseAlertView extends SystemResponseAlert {
    outputHtml?: string;
}

export interface SystemLogBlock {
    id: number;
    html: string;
    length: number;
}

export interface SystemResponseSnapshot {
    open: boolean;
    outputBlocks: SystemLogBlock[];
    alert: SystemResponseAlertView | null;
}

export interface SystemResponseModalProps {
    snapshot: SystemResponseSnapshot;
    theme?: DashboardTheme;
    onClose: () => void;
    onCloseRefresh: () => void;
    onCloseAlert: () => void;
}

const LogBlock = React.memo(function LogBlock({ block }: { block: SystemLogBlock }) {
    return <span data-log-block={block.id} dangerouslySetInnerHTML={{ __html: block.html }} />;
});

function SystemLogOutput({ open, blocks }: { open: boolean; blocks: SystemLogBlock[] }) {
    const outputRef = React.useRef<HTMLDivElement>(null);
    const outputScroll = React.useRef({ top: 0, height: 0, clientHeight: 0 });
    const previousBlocks = React.useRef<SystemLogBlock[]>([]);

    React.useLayoutEffect(() => {
        const output = outputRef.current;
        if (!open) {
            outputScroll.current = { top: 0, height: 0, clientHeight: 0 };
            previousBlocks.current = blocks;
            return;
        }
        if (!output) {
            return;
        }
        if (previousBlocks.current !== blocks) {
            const previous = outputScroll.current;
            const distanceFromBottom = previous.height - previous.top - previous.clientHeight;
            output.scrollTop = previous.height === 0 || distanceFromBottom < 2 ? output.scrollHeight : previous.top;
            previousBlocks.current = blocks;
        }
        outputScroll.current = { top: output.scrollTop, height: output.scrollHeight, clientHeight: output.clientHeight };
    }, [blocks, open]);

    return (
        <div
            id="sysPre"
            ref={outputRef}
            className="qb-system-response-output"
            style={{ height: "min(600px, calc(100vh - 220px))", overflowY: "auto", overflowAnchor: "none" }}
            onScroll={(event) => {
                const output = event.currentTarget;
                outputScroll.current = { top: output.scrollTop, height: output.scrollHeight, clientHeight: output.clientHeight };
            }}
        >
            <pre className="sysout">
                <span id="sshoutput">{blocks.map((block) => <LogBlock key={block.id} block={block} />)}</span>
            </pre>
        </div>
    );
}

export function SystemResponseModal({ snapshot, theme = "defaulted", onClose, onCloseRefresh, onCloseAlert }: SystemResponseModalProps) {
    const { t } = useTranslation();
    return (
        <ConfigProvider theme={getAntdThemeConfig(theme, { borderRadius: 4 })}>
            <Modal
                open={snapshot.open}
                title={t("SYSTEM_RESPONSE_TITLE")}
                width={600}
                centered
                zIndex={2200}
                transitionName=""
                closable
                closeIcon={<span id="sysResponseDismiss" aria-label={t("CLOSE")}>&times;</span>}
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
                        {t("CLOSE_REFRESH")}
                    </Button>
                )}
            >
                <SystemLogOutput open={snapshot.open} blocks={snapshot.outputBlocks} />
            </Modal>
            <Modal
                open={snapshot.alert !== null}
                title={t("SYSTEM_RESPONSE_TITLE")}
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
                footer={<Button type="primary" onClick={onCloseAlert}>OK</Button>}
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
