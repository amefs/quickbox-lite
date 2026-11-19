// SPDX-License-Identifier: GPL-3.0-or-later

import React from "react";
import { Button, ConfigProvider, Modal } from "antd";

import type { SystemResponseLabels } from "../../../ws/src/shared/system-response-contract";
import type { DashboardTheme } from "../../../ws/src/shared/theme";
import { getAntdThemeConfig } from "../runtime/theme-store";

const ALERT_TAGS = new Set(["BR", "CODE", "HR", "DIV", "SPAN"]);

function parseSafeAlertStyle(styleText: string | null): React.CSSProperties | undefined {
    if (styleText === null) {
        return undefined;
    }
    const style: React.CSSProperties = {};
    for (const declaration of styleText.split(";")) {
        const separator = declaration.indexOf(":");
        if (separator < 0) {
            continue;
        }
        const property = declaration.slice(0, separator).trim().toLowerCase();
        const value = declaration.slice(separator + 1).trim();
        if (["color", "background-color"].includes(property) && /^(#[\da-f]{3,8}|rgba?\([\d\s.,%]+\)|[a-z]{1,24})$/i.test(value)) {
            if (property === "color") {
                style.color = value;
            } else {
                style.backgroundColor = value;
            }
        } else if (property === "font-weight" && /^(normal|bold|[1-9]00)$/.test(value)) {
            style.fontWeight = value;
        } else if (property === "font-style" && /^(normal|italic|oblique)$/.test(value)) {
            style.fontStyle = value;
        } else if (property === "text-decoration" && /^(none|underline|line-through)$/.test(value)) {
            style.textDecoration = value;
        }
    }
    return Object.keys(style).length > 0 ? style : undefined;
}

function renderAlertNode(node: Node, key: string): React.ReactNode {
    if (node.nodeType === Node.TEXT_NODE) {
        return node.textContent ?? "";
    }
    if (!(node instanceof Element)) {
        return null;
    }
    const children = Array.from(node.childNodes).map((child, index) => renderAlertNode(child, `${key}-${index}`));
    const tag = node.tagName.toUpperCase();
    if (!ALERT_TAGS.has(tag)) {
        return <React.Fragment key={key}>{children}</React.Fragment>;
    }
    const props: { key: string; className?: string; style?: React.CSSProperties } = { key };
    if (tag === "DIV" && node.classList.contains("exec-output")) {
        props.className = "exec-output";
    }
    if (tag === "SPAN") {
        props.style = parseSafeAlertStyle(node.getAttribute("style"));
    }
    return React.createElement(tag.toLowerCase(), props, ...children);
}

function parseAlertMarkup(markup: string): React.ReactNode[] {
    const documentNode = new DOMParser().parseFromString(markup, "text/html");
    return Array.from(documentNode.body.childNodes).map((node, index) => renderAlertNode(node, `alert-${index}`));
}

export interface SystemResponseSnapshot {
    open: boolean;
    outputHtml: string;
    alertHtml: string | null;
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
                zIndex={1050}
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
                <div id="sysPre" ref={outputRef} className="qb-system-response-output" style={{ maxHeight: "min(600px, calc(100vh - 220px))", overflowY: "auto" }} onScroll={(event) => {
                    const output = event.currentTarget;
                    outputScroll.current = { top: output.scrollTop, height: output.scrollHeight, clientHeight: output.clientHeight };
                }}>
                    <pre className="sysout"><span id="sshoutput" dangerouslySetInnerHTML={{ __html: snapshot.outputHtml }} /></pre>
                </div>
            </Modal>
            <Modal
                open={snapshot.alertHtml !== null}
                title={labels.title}
                width={600}
                centered
                zIndex={1060}
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
                {parseAlertMarkup(snapshot.alertHtml ?? "")}
            </Modal>
        </ConfigProvider>
    );
}
