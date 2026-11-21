// SPDX-License-Identifier: GPL-3.0-or-later

import React from "react";
import { Trans, useTranslation } from "react-i18next";
import Markdown from "react-markdown";
import { toString as mdastToString } from "mdast-util-to-string";
import remarkParse from "remark-parse";
import { unified } from "unified";
import { Button, ConfigProvider, Input, Modal, Table, Tooltip, type TableProps } from "antd";

import type {
    PackageManagementData,
    PackageManagementRow,
    PackageManagementTheme,
} from "../../../ws/src/shared/package-management-contract";
import { getAntdThemeConfig } from "../runtime/theme-store";
import { executeBoxAction, useCommandConnection } from "../runtime/dashboard-runtime-client";
import { systemResponseActions } from "../runtime/system-response-client";
import { SkeletonText } from "./placeholder";

const INLINE_MARKDOWN_COMPONENTS = {
    p: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
    a: ({ href, children }: { href?: string; children?: React.ReactNode }) => (
        <a href={href} target="_blank" rel="noopener noreferrer">
            {children}
        </a>
    ),
};

const markdownTextParser = unified().use(remarkParse);

function markdownToPlainText(markdown: string): string {
    return mdastToString(markdownTextParser.parse(markdown)).replace(/\s+/g, " ").trim();
}

export interface PackageManagementCenterProps {
    data: PackageManagementData | null;
    theme: PackageManagementTheme;
    onPackageAction?: (action: "install" | "remove", row: PackageManagementRow) => void;
}

export function PackageManagementCenterView({ data, theme, onPackageAction }: PackageManagementCenterProps) {
    const { t } = useTranslation();
    const loading = data === null;
    const [search, setSearch] = React.useState("");
    const [page, setPage] = React.useState(1);
    const [pageSize, setPageSize] = React.useState(10);
    const [sortKey, setSortKey] = React.useState<"name" | "descriptionText" | "availability">("name");
    const [sortOrder, setSortOrder] = React.useState<"ascend" | "descend">("ascend");
    const [confirmRow, setConfirmRow] = React.useState<PackageManagementRow | null>(null);
    const [noticeVisible, setNoticeVisible] = React.useState(true);

    const containConfirmTab = (event: React.KeyboardEvent<HTMLDivElement>) => {
        if (event.key !== "Tab") {return;}
        const dialog = event.currentTarget.querySelector<HTMLElement>(".ant-modal");
        if (!dialog) {return;}
        const focusable = [...dialog.querySelectorAll<HTMLElement>("*")].filter((element) => {
            if (element.tabIndex < 0 || element.matches(":disabled") || element.closest("[inert], [aria-hidden='true' i]")) {return false;}
            const style = getComputedStyle(element);
            return element.getClientRects().length > 0 && style.display !== "none" && style.visibility !== "hidden" && style.visibility !== "collapse";
        }).sort((left, right) => {
            if (left.tabIndex > 0 && right.tabIndex > 0) {return left.tabIndex - right.tabIndex;}
            if (left.tabIndex > 0) {return -1;}
            if (right.tabIndex > 0) {return 1;}
            return 0;
        });
        if (focusable.length === 0) {return;}
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
        }
    };

    const rows = React.useMemo(() => data?.rows.map((row) => ({
        ...row,
        descriptionText: markdownToPlainText(row.descriptionKey ? t(row.descriptionKey) : (row.descriptionText ?? "")),
    })), [data, t]);

    React.useEffect(() => {
        setNoticeVisible(true);
    }, [rows]);

    const availabilityText = (row: PackageManagementRow) => t(row.installed ? "INSTALLED" : row.boxOnly ? "BOX" : "INSTALL");

    const searchTerms = (search.toLocaleLowerCase().match(/"[^"]+"|[^ ]+/g) ?? [])
        .map((term) => term.startsWith('"') && term.endsWith('"') ? term.slice(1, -1) : term.replace('"', ""));
    const filteredRows = (rows ?? []).filter((row) => {
        const searchable = `${row.name} ${row.descriptionText} ${availabilityText(row)}`.toLocaleLowerCase();
        return searchTerms.every((term) => searchable.includes(term));
    });
    React.useEffect(() => {
        const lastPage = Math.max(1, Math.ceil(filteredRows.length / pageSize));
        setPage((current) => Math.min(current, lastPage));
    }, [filteredRows.length, pageSize]);

    const sortedRows = [...filteredRows].sort((left, right) => {
        const leftValue = sortKey === "availability"
            ? availabilityText(left)
            : left[sortKey];
        const rightValue = sortKey === "availability"
            ? availabilityText(right)
            : right[sortKey];
        const comparison = leftValue.localeCompare(rightValue, undefined, { sensitivity: "base" });
        return sortOrder === "ascend" ? comparison : -comparison;
    });
    const pageRows = sortedRows.slice((page - 1) * pageSize, page * pageSize);
    const commandsConnected = useCommandConnection();
    const pageCount = Math.ceil(filteredRows.length / pageSize);
    const rangeStart = filteredRows.length === 0 ? 0 : (page - 1) * pageSize + 1;
    const rangeEnd = Math.min(page * pageSize, filteredRows.length);
    const columns: NonNullable<TableProps<PackageManagementRow>["columns"]> = [
        {
            title: t("NAME"),
            dataIndex: "name",
            key: "name",
            width: "var(--qb-pmc-name-width)",
            sorter: true,
            sortOrder: sortKey === "name" ? sortOrder : null,
            render: (_value, row) => row.name,
        },
        {
            title: t("DETAILS"),
            dataIndex: "descriptionText",
            key: "descriptionText",
            sorter: true,
            sortOrder: sortKey === "descriptionText" ? sortOrder : null,
            render: (_value, row) => (
                <span>
                    {row.descriptionKey ? (
                        <Markdown components={INLINE_MARKDOWN_COMPONENTS}>{t(row.descriptionKey)}</Markdown>
                    ) : (
                        row.descriptionText
                    )}
                </span>
            ),
        },
        {
            title: t("AVAILABILITY"),
            key: "availability",
            width: "var(--qb-pmc-availability-width)",
            sorter: true,
            sortOrder: sortKey === "availability" ? sortOrder : null,
            render: (_value, row) => {
                if (row.installed) {
                    const canRemove = !row.boxOnly && Boolean(row.uninstallKey);
                    return (
                        <Button
                            size="small"
                            type="primary"
                            className="btn btn-xs btn-success package-action-btn"
                            disabled={!commandsConnected}
                            onClick={() => { if (canRemove) { setConfirmRow(row); } }}
                        >
                            {t("INSTALLED")}
                        </Button>
                    );
                }
                if (row.boxOnly) {
                    return (
                        <Tooltip title={row.installTooltipKey ? t(row.installTooltipKey) : row.installTooltip} placement="top" classNames={{ root: "qb-package-tooltip-popup" }}>
                            <span>
                                <Button size="small" danger disabled className="btn btn-xs btn-danger disabled tooltips package-action-btn">
                                    {t("BOX")}
                                </Button>
                            </span>
                        </Tooltip>
                    );
                }
                return (
                    <Button
                        size="small"
                        className="btn btn-xs btn-default package-action-btn"
                        disabled={!commandsConnected}
                        onClick={() => onPackageAction?.("install", row)}
                    >
                        {t("INSTALL")}
                    </Button>
                );
            },
        },
    ];

    const tableChange: NonNullable<TableProps<PackageManagementRow>["onChange"]> = (_pagination, _filters, sorter) => {
        const selectedSorter = Array.isArray(sorter) ? sorter[0] : sorter;
        if (!selectedSorter.columnKey || !selectedSorter.order) {
            return;
        }
        if (selectedSorter.columnKey === "name" || selectedSorter.columnKey === "descriptionText" || selectedSorter.columnKey === "availability") {
            setSortKey(selectedSorter.columnKey);
            setSortOrder(selectedSorter.order);
        }
    };

    return (
        <ConfigProvider theme={getAntdThemeConfig(theme, { colorPrimary: "#2574ab", fontFamily: '"Open Sans"', borderRadius: 3, controlHeightSM: 24 })}>
            <div className={`panel panel-main panel-inverse qb-package-management qb-package-management--${theme}`} data-inner-id="panel-server-package-management" aria-busy={loading}>
                <div className="panel-heading"><h2 className="panel-title">{t("PACKAGE_MANAGEMENT_CENTER")}</h2></div>
                <div className="panel-body text-center" style={{ padding: 0 }} inert={loading}>
                    {noticeVisible ? (
                        <div className="alert alert-danger">
                            <button type="button" className="close" aria-label={t("CLOSE")} onClick={() => { setNoticeVisible(false); }}><span aria-hidden="true">&times;</span></button>
                            <div style={{ textAlign: "center" }}><Trans i18nKey="PMC_NOTICE_TXT" /></div>
                        </div>
                    ) : null}
                    <div className="qb-package-management__toolbar">
                        <label className="qb-package-management__page-size" htmlFor="quickbox-pmc-page-size">
                            <Trans i18nKey="PMC_PAGE_SIZE" components={{
                                select: (
                                    <select
                                        id="quickbox-pmc-page-size"
                                        className="form-control input-sm"
                                        aria-label={t("PMC_ENTRIES_PER_PAGE")}
                                        value={pageSize}
                                        disabled={loading}
                                        onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1); }}
                                    >
                                        {[10, 25, 50, 100].map((size) => <option key={size} value={size}>{size}</option>)}
                                    </select>
                                ),
                            }} />
                        </label>
                        <label className="qb-package-management__search" htmlFor="dataTable1-search">
                            {t("PMC_SEARCH")}
                            <Input
                                id="dataTable1-search"
                                name="dataTable1-search"
                                value={search}
                                disabled={loading}
                                onChange={(event) => { setSearch(event.target.value); setPage(1); }}
                            />
                        </label>
                    </div>
                    <div className="qb-package-management__table-scroll" role="region" aria-label={t("PACKAGE_MANAGEMENT_CENTER")} tabIndex={0}>
                        <Table<PackageManagementRow>
                            className="qb-package-management__table"
                            rowKey="package"
                            size="small"
                            columns={columns}
                            dataSource={pageRows}
                            onChange={tableChange}
                            locale={{ emptyText: loading ? (
                                <div className="qb-package-management__loading" aria-hidden="true">
                                    {Array.from({ length: pageSize }, (_, index) => (
                                        <div className="qb-package-management__loading-row" key={index}>
                                            <SkeletonText width="65%" />
                                            <SkeletonText width="85%" />
                                            <SkeletonText width="60%" />
                                        </div>
                                    ))}
                                </div>
                            ) : t("PMC_NO_RECORDS") }}
                            tableLayout="fixed"
                            pagination={false}
                        />
                    </div>
                    <div className="qb-package-management__pagination">
                        <div role="status">{loading ? <SkeletonText width="14ch" /> : t("PMC_RESULT_RANGE", { start: rangeStart, end: rangeEnd, total: filteredRows.length })}</div>
                        <ul id="dataTable1_paginate" className="pagination">
                            <li className={`paginate_button previous ${page <= 1 ? "disabled" : ""}`}>
                                <a href="#" aria-label={t("PMC_PREVIOUS_PAGE")} aria-disabled={page <= 1} tabIndex={page <= 1 ? -1 : 0} onClick={(event) => { event.preventDefault(); if (page > 1) { setPage(page - 1); } }}>{t("PMC_PREVIOUS")}</a>
                            </li>
                            {Array.from({ length: pageCount }, (_value, index) => index + 1).map((pageNumber) => (
                                <li key={pageNumber} className={`paginate_button ${pageNumber === page ? "active" : ""}`}>
                                    <a href="#" aria-label={t("PMC_PAGE_NUMBER", { page: pageNumber })} aria-current={pageNumber === page ? "page" : undefined} onClick={(event) => { event.preventDefault(); setPage(pageNumber); }}>{pageNumber}</a>
                                </li>
                            ))}
                            <li className={`paginate_button next ${page >= pageCount ? "disabled" : ""}`}>
                                <a href="#" aria-label={t("PMC_NEXT_PAGE")} aria-disabled={page >= pageCount} tabIndex={page >= pageCount ? -1 : 0} onClick={(event) => { event.preventDefault(); if (page < pageCount) { setPage(page + 1); } }}>{t("PMC_NEXT")}</a>
                            </li>
                        </ul>
                    </div>
                    {data?.installLockExists ? (
                        <div className="qb-package-management__lock">
                            <hr />
                            <span><Trans i18nKey="CLEAR_LOCK_TXT" /></span>&nbsp; &nbsp; &nbsp; &nbsp;
                            <Button
                                size="small"
                                className="btn btn-xs btn-default"
                                disabled={!commandsConnected}
                                onClick={() => { executeBoxAction("fix", "dpkg", true); }}
                            >
                                {t("CLEAR_LOCK")}
                            </Button>
                            {" "}
                            <Button
                                size="small"
                                type="primary"
                                className="btn btn-xs btn-info"
                                data-qb-system-response
                                onClick={() => { systemResponseActions.open(); }}
                            >
                                {t("VIEW_LOG")}
                            </Button>
                        </div>
                    ) : null}
                </div>
                <Modal
                    open={confirmRow !== null}
                    centered
                    zIndex={2200}
                    title={confirmRow ? `${t("UNINSTALL_TITLE")} ${confirmRow.name}?` : ""}
                    onCancel={() => { setConfirmRow(null); }}
                    wrapProps={{ onKeyDownCapture: containConfirmTab }}
                    footer={[
                        <Button key="cancel" onClick={() => { setConfirmRow(null); }}>{t("CANCEL")}</Button>,
                        <Button key="confirm" type="primary" disabled={!commandsConnected} onClick={() => {
                            const selected = confirmRow;
                            setConfirmRow(null);
                            if (selected) {onPackageAction?.("remove", selected);}
                        }}>{t("AGREE")}</Button>,
                    ]}
                    destroyOnHidden
                >
                    {confirmRow?.uninstallKey ? (
                        <div><Trans i18nKey={confirmRow.uninstallKey} /></div>
                    ) : null}
                </Modal>
            </div>
        </ConfigProvider>
    );
}
