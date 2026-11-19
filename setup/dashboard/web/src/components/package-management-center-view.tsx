// SPDX-License-Identifier: GPL-3.0-or-later

import React from "react";
import { Button, ConfigProvider, Input, Modal, Table, Tooltip, type TableProps } from "antd";

import type {
    PackageManagementData,
    PackageManagementLabels,
    PackageManagementRow,
    PackageManagementTheme,
} from "../../../ws/src/shared/package-management-contract";
import { getAntdThemeConfig } from "../runtime/theme-store";

export interface PackageManagementCenterProps {
    data: PackageManagementData;
    labels: PackageManagementLabels;
    theme: PackageManagementTheme;
    onPackageAction?: (action: "install" | "remove", row: PackageManagementRow) => void;
}

export function PackageManagementCenterView({ data, labels, theme, onPackageAction }: PackageManagementCenterProps) {
    const [search, setSearch] = React.useState("");
    const [page, setPage] = React.useState(1);
    const [pageSize, setPageSize] = React.useState(10);
    const [sortKey, setSortKey] = React.useState<"name" | "descriptionText" | "availability">("name");
    const [sortOrder, setSortOrder] = React.useState<"ascend" | "descend">("ascend");
    const [confirmRow, setConfirmRow] = React.useState<PackageManagementRow | null>(null);
    const [noticeVisible, setNoticeVisible] = React.useState(true);
    const tableViewport = React.useRef<HTMLDivElement>(null);
    const [columnWidths, setColumnWidths] = React.useState<number[]>([]);
    const initialRows = React.useRef(data.rows);
    const initialWidth = React.useRef<number | null>(null);
    const remeasured = React.useRef(false);

    React.useLayoutEffect(() => {
        const viewport = tableViewport.current;
        if (!viewport) {return;}
        let active = true;
        const measure = () => {
            if (!active) {return;}
            const table = viewport.querySelector<HTMLTableElement>(".ant-table table");
            const parent = table?.parentElement;
            if (!table || !parent || viewport.clientWidth === 0) {return;}
            initialWidth.current ??= viewport.clientWidth;
            if (viewport.clientWidth !== initialWidth.current || data.rows !== initialRows.current) {remeasured.current = true;}
            const coldStartup = !remeasured.current;
            // Measure the complete catalog so paging and search do not change
            // intrinsic column widths established by the original table.
            const sizingTable = table.cloneNode(true) as HTMLTableElement;
            sizingTable.querySelector("colgroup")?.remove();
            const body = sizingTable.querySelector("tbody");
            if (!body) {return;}
            body.replaceChildren();
            const sizingFont = /[\u3400-\u9fff]/.test(labels.name) ? "sans-serif" : "serif";
            for (const row of data.rows) {
                const tr = document.createElement("tr");
                [row.name, row.descriptionHtml, row.installed ? labels.installed : row.boxOnly ? labels.box : labels.install].forEach((content, index) => {
                    const cell = document.createElement("td");
                    cell.className = "ant-table-cell";
                    if (coldStartup) {cell.style.fontFamily = sizingFont;}
                    tr.appendChild(cell);
                    if (index === 1) {
                        cell.innerHTML = content;
                    } else if (index === 2) {
                        const button = document.createElement("button");
                        button.className = "ant-btn package-action-btn";
                        button.textContent = content;
                        button.tabIndex = -1;
                        cell.appendChild(button);
                    } else {
                        cell.textContent = content;
                    }
                });
                body.appendChild(tr);
            }
            sizingTable.setAttribute("aria-hidden", "true");
            Object.assign(sizingTable.style, { position: "fixed", top: "0", visibility: "hidden", pointerEvents: "none", tableLayout: "auto", width: `${viewport.clientWidth}px` });
            const headers = [...sizingTable.querySelectorAll("th")];
            if (coldStartup) {headers.forEach((cell) => { cell.style.fontFamily = '"Helvetica Neue", Helvetica, sans-serif'; });}
            parent.appendChild(sizingTable);
            // The frozen page established widths before its webfont arrived,
            // then paged the catalog. Reproduce those measurements without
            // changing the font used by the visible Ant Design table.
            if (coldStartup) {
                const initialWidths = headers.map((cell) => {
                    const style = getComputedStyle(cell);
                    return cell.getBoundingClientRect().width - Number.parseFloat(style.paddingLeft) - Number.parseFloat(style.paddingRight);
                });
                headers.forEach((cell, index) => {
                    cell.style.boxSizing = "content-box";
                    cell.style.width = `${initialWidths[index]}px`;
                    cell.style.fontFamily = "";
                });
                [...body.rows].slice(10).forEach((row) => { row.remove(); });
                body.querySelectorAll("td").forEach((cell) => { cell.style.fontFamily = ""; });
            }
            const widths = headers.map((cell) => cell.getBoundingClientRect().width);
            sizingTable.remove();
            setColumnWidths((previous) => widths.every((width, index) => Math.abs(width - (previous[index] ?? 0)) < 0.01) ? previous : widths);
        };
        measure();
        const observer = new ResizeObserver(measure);
        observer.observe(viewport);
        void document.fonts.ready.then(measure);
        return () => { active = false; observer.disconnect(); };
    }, [data.rows, labels]);

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

    React.useEffect(() => {
        setNoticeVisible(true);
    }, [data]);

    const searchTerms = (search.toLocaleLowerCase().match(/"[^"]+"|[^ ]+/g) ?? [])
        .map((term) => term.startsWith('"') && term.endsWith('"') ? term.slice(1, -1) : term.replace('"', ""));
    const filteredRows = data.rows.filter((row) => {
        const searchable = `${row.name} ${row.descriptionText} ${row.installed ? labels.installed : row.boxOnly ? labels.box : labels.install}`.toLocaleLowerCase();
        return searchTerms.every((term) => searchable.includes(term));
    });
    React.useEffect(() => {
        const lastPage = Math.max(1, Math.ceil(filteredRows.length / pageSize));
        setPage((current) => Math.min(current, lastPage));
    }, [filteredRows.length, pageSize]);

    const sortedRows = [...filteredRows].sort((left, right) => {
        const leftValue = sortKey === "availability"
            ? (left.installed ? labels.installed : left.boxOnly ? labels.box : labels.install)
            : left[sortKey];
        const rightValue = sortKey === "availability"
            ? (right.installed ? labels.installed : right.boxOnly ? labels.box : labels.install)
            : right[sortKey];
        const comparison = leftValue.localeCompare(rightValue, undefined, { sensitivity: "base" });
        return sortOrder === "ascend" ? comparison : -comparison;
    });
    const pageRows = sortedRows.slice((page - 1) * pageSize, page * pageSize);
    const pageCount = Math.ceil(filteredRows.length / pageSize);
    const rangeStart = filteredRows.length === 0 ? 0 : (page - 1) * pageSize + 1;
    const rangeEnd = Math.min(page * pageSize, filteredRows.length);
    const columns: NonNullable<TableProps<PackageManagementRow>["columns"]> = [
        {
            title: labels.name,
            dataIndex: "name",
            key: "name",
            width: columnWidths[0] ?? "13.195%",
            sorter: true,
            sortOrder: sortKey === "name" ? sortOrder : null,
            render: (_value, row) => row.name,
        },
        {
            title: labels.details,
            dataIndex: "descriptionText",
            key: "descriptionText",
            width: columnWidths[1] ?? "70.367%",
            sorter: true,
            sortOrder: sortKey === "descriptionText" ? sortOrder : null,
            render: (_value, row) => <span dangerouslySetInnerHTML={{ __html: row.descriptionHtml }} />,
        },
        {
            title: labels.availability,
            key: "availability",
            width: columnWidths[2] ?? "16.438%",
            sorter: true,
            sortOrder: sortKey === "availability" ? sortOrder : null,
            render: (_value, row) => {
                if (row.installed) {
                    const canRemove = !row.boxOnly && Boolean(row.uninstallHtml);
                    return (
                        <Button
                            size="small"
                            type="primary"
                            className="btn btn-xs btn-success package-action-btn"
                            onClick={() => { if (canRemove) { setConfirmRow(row); } }}
                        >
                            {labels.installed}
                        </Button>
                    );
                }
                if (row.boxOnly) {
                    return (
                        <Tooltip title={row.installTooltip} placement="top" classNames={{ root: "qb-package-tooltip-popup" }}>
                            <span>
                                <Button size="small" danger disabled className="btn btn-xs btn-danger disabled tooltips package-action-btn">
                                    {labels.box}
                                </Button>
                            </span>
                        </Tooltip>
                    );
                }
                return (
                    <Button
                        size="small"
                        className="btn btn-xs btn-default package-action-btn"
                        onClick={() => onPackageAction?.("install", row)}
                    >
                        {labels.install}
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
            <div className={`panel panel-main panel-inverse qb-package-management qb-package-management--${theme}`} data-inner-id="panel-server-package-management">
                <div className="panel-heading"><h4 className="panel-title">{labels.title}</h4></div>
                <div className="panel-body text-center" style={{ padding: 0 }}>
                    {noticeVisible ? (
                        <div className="alert alert-danger">
                            <button type="button" className="close" aria-label="Close" onClick={() => { setNoticeVisible(false); }}><span aria-hidden="true">&times;</span></button>
                            <div style={{ textAlign: "center" }} dangerouslySetInnerHTML={{ __html: labels.noticeHtml }} />
                        </div>
                    ) : null}
                    <div ref={tableViewport} className="table-responsive ps">
                        <div id="dataTable1_wrapper" className="dataTables_wrapper form-inline dt-bootstrap no-footer">
                            <div className="row qb-package-management__toolbar">
                                <div className="col-sm-6">
                                    <div id="dataTable1_length" className="dataTables_length">
                                        <label htmlFor="quickbox-pmc-page-size">
                                            Show
                                            {" "}
                                            <select
                                                id="quickbox-pmc-page-size"
                                                className="form-control input-sm"
                                                aria-label="Entries per page"
                                                value={pageSize}
                                                onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1); }}
                                            >
                                                {[10, 25, 50, 100].map((size) => <option key={size} value={size}>{size}</option>)}
                                            </select>
                                            {" "}
                                            entries
                                        </label>
                                    </div>
                                </div>
                                <div className="col-sm-6">
                                    <div id="dataTable1_filter" className="dataTables_filter">
                                        <label htmlFor="dataTable1-search">
                                            Search:
                                            <Input
                                                id="dataTable1-search"
                                                name="dataTable1-search"
                                                className="form-control input-sm"
                                                aria-label={labels.searchPlaceholder}
                                                value={search}
                                                onChange={(event) => { setSearch(event.target.value); setPage(1); }}
                                            />
                                        </label>
                                    </div>
                                </div>
                            </div>
                            <Table<PackageManagementRow>
                                className="qb-package-management__table"
                                rowKey="package"
                                size="small"
                                columns={columns}
                                dataSource={pageRows}
                                onChange={tableChange}
                                locale={{ emptyText: labels.empty }}
                                tableLayout="fixed"
                                pagination={false}
                            />
                            <div className="row qb-package-management__pagination">
                                <div className="col-sm-6">
                                    <div id="dataTable1_info" className="dataTables_info" role="status">Showing {rangeStart} to {rangeEnd} of {filteredRows.length} {labels.total}</div>
                                </div>
                                <div className="col-sm-6">
                                    <div id="dataTable1_paginate" className="dataTables_paginate">
                                        <ul className="pagination">
                                            <li className={`paginate_button previous ${page <= 1 ? "disabled" : ""}`}>
                                                <a href="#" aria-label="Previous page" aria-disabled={page <= 1} tabIndex={page <= 1 ? -1 : 0} onClick={(event) => { event.preventDefault(); if (page > 1) { setPage(page - 1); } }}>Previous</a>
                                            </li>
                                            {Array.from({ length: pageCount }, (_value, index) => index + 1).map((pageNumber) => (
                                                <li key={pageNumber} className={`paginate_button ${pageNumber === page ? "active" : ""}`}>
                                                    <a href="#" aria-label={`Page ${pageNumber}`} aria-current={pageNumber === page ? "page" : undefined} onClick={(event) => { event.preventDefault(); setPage(pageNumber); }}>{pageNumber}</a>
                                                </li>
                                            ))}
                                            <li className={`paginate_button next ${page >= pageCount ? "disabled" : ""}`}>
                                                <a href="#" aria-label="Next page" aria-disabled={page >= pageCount} tabIndex={page >= pageCount ? -1 : 0} onClick={(event) => { event.preventDefault(); if (page < pageCount) { setPage(page + 1); } }}>Next</a>
                                            </li>
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    {data.installLockExists ? (
                        <div className="qb-package-management__lock">
                            <hr />
                            <span dangerouslySetInnerHTML={{ __html: labels.clearLockHtml }} />&nbsp; &nbsp; &nbsp; &nbsp;
                            <Button
                                size="small"
                                className="btn btn-xs btn-default"
                                data-click-handler="boxHandler"
                                data-package="dpkg"
                                data-operation="fix"
                                data-target="#sysResponse"
                            >
                                {labels.clearLock}
                            </Button>
                            {" "}
                            <Button size="small" type="primary" className="btn btn-xs btn-info" data-qb-system-response>{labels.viewLog}</Button>
                        </div>
                    ) : null}
                </div>
                <Modal
                    open={confirmRow !== null}
                    centered
                    title={confirmRow ? `${labels.uninstallTitle} ${confirmRow.name}?` : ""}
                    onCancel={() => { setConfirmRow(null); }}
                    wrapProps={{ onKeyDownCapture: containConfirmTab }}
                    footer={[
                        <Button key="cancel" onClick={() => { setConfirmRow(null); }}>{labels.cancel}</Button>,
                        <Button key="confirm" type="primary" onClick={() => {
                            const selected = confirmRow;
                            setConfirmRow(null);
                            if (selected) {onPackageAction?.("remove", selected);}
                        }}>{labels.agree}</Button>,
                    ]}
                    destroyOnHidden
                >
                    {confirmRow?.uninstallHtml ? <div dangerouslySetInnerHTML={{ __html: confirmRow.uninstallHtml }} /> : null}
                </Modal>
            </div>
        </ConfigProvider>
    );
}
