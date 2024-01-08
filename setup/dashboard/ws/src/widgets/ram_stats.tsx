import si from "systeminformation";
import React from "react";
import ReactDOMServer from "react-dom/server";
import { toNumber } from "lodash";
import i18n from "../i18n";
import { formatSize } from "../utils";

function getRamColor(percent: number | string) {
    percent = toNumber(percent);
    if (percent >= 90) {
        return "progress-bar-danger";
    }
    if (percent >= 70) {
        return "progress-bar-warning";
    }

    return "progress-bar-success";
}

export async function ramStats() {
    const mem = await si.mem();
    const ret: React.JSX.Element[] = [];

    const memUsed = formatSize(mem.used);
    const memFree = formatSize(mem.free);
    const memTotal = formatSize(mem.total);
    const memPercent = toNumber((mem.used / mem.total * 100).toFixed(2));

    const memRealUsedNumber = mem.used - mem.cached - mem.buffers;
    const memRealUsed = formatSize(memRealUsedNumber);
    const memRealFree = formatSize(mem.total - memRealUsedNumber);
    const memRealPercent = toNumber((memRealUsedNumber / mem.total * 100).toFixed(2));

    const memBuffers = formatSize(mem.buffers);
    const memCached = formatSize(mem.cached);
    const memCachedPercent = toNumber((mem.cached / mem.total * 100).toFixed(2));

    const memSwapUsed = formatSize(mem.swapused);
    const memSwapFree = formatSize(mem.swapfree);
    const memSwapTotal = formatSize(mem.swaptotal);
    const swapPercent = toNumber((mem.swapused / mem.swaptotal * 100).toFixed(2));

    let ramcolor = getRamColor(memPercent);
    // PHSYSICAL MEMORY USAGE
    ret.push(<div key="phsysical" className="col-sm-12">
        <p style={{fontSize:"10px"}}>{i18n.t("PHYSICAL_MEMORY_TITLE")}: {memPercent}%<div></div>
            {i18n.t("PHYSICAL_MEMORY_USED_TXT")}: <div style={{color: "#eb4549", display: "contents"}}>{memUsed}</div>  | {i18n.t("PHYSICAL_MEMORY_IDLE_TXT")}: <div style={{color: "#eb4549", display: "contents"}}>{memFree}</div>
        </p>
        <div className="progress progress-striped">
            <div style={{width:`${memPercent}%`}} aria-valuemax={100} aria-valuemin={0} aria-valuenow={memPercent} role="progressbar" className={`progress-bar ${ramcolor}`}>
                <span className="sr-only">{memPercent}% {i18n.t("USED")}</span>
            </div>
        </div>
    </div>);
    if (mem.cached > 1e-5) {
        // CACHED MEMORY USAGE
        ramcolor = getRamColor(memCachedPercent);
        ret.push(<div key="cached" className="col-sm-12" style={{paddingTop:"10px"}}>
            <p style={{fontSize:"10px"}}>{i18n.t("CACHED_MEMORY_TITLE")}: {memCachedPercent}%<div></div>
                {i18n.t("CACHED_MEMORY_USAGE_TXT", {cached: memCached})} | {i18n.t("CACHED_MEMORY_BUFFERS_TXT", {buffered: memBuffers})}
            </p>
            <div className="progress progress-striped">
                <div style={{width:`${memCachedPercent}%`}} aria-valuemax={100} aria-valuemin={0} aria-valuenow={memCachedPercent} role="progressbar" className={`progress-bar ${ramcolor}`}>
                    <span className="sr-only">{memCachedPercent}% {i18n.t("USED")}</span>
                </div>
            </div>
        </div>);
        // REAL MEMORY USAGE
        ramcolor = getRamColor(memRealPercent);
        ret.push(
            <div key="real" className="col-sm-12" style={{paddingTop:"10px"}}>
                <p style={{fontSize:"10px"}}>{i18n.t("REAL_MEMORY_TITLE")}: {memRealPercent}%<div></div>
                    {i18n.t("REAL_MEMORY_USAGE_TXT", {used: memRealUsed})} | {i18n.t("REAL_MEMORY_FREE_TXT", {free: memRealFree})}
                </p>
                <div className="progress progress-striped">
                    <div style={{width:`${memRealPercent}%`}} aria-valuemax={100} aria-valuemin={0} aria-valuenow={memRealPercent} role="progressbar" className={`progress-bar ${ramcolor}`}>
                        <span className="sr-only">{memRealPercent}% {i18n.t("USED")}</span>
                    </div>
                </div>
            </div>
        );
    }

    if (mem.swaptotal > 1e-5) {
        // SWAP USAGE
        ramcolor = getRamColor(swapPercent);
        ret.push(<div key="swap" className="col-sm-12" style={{paddingTop:"10px"}}>
            <p style={{fontSize:"10px"}}>
                {i18n.t("SWAP_TITLE")}: {swapPercent}%<div></div>
                {i18n.t("SWAP_TOTAL_TXT")}: {i18n.t("TOTAL_L", {total: memSwapTotal})} | {i18n.t("SWAP_USED_TXT", {used: memSwapUsed})} | {i18n.t("SWAP_IDLE_TXT", {free: memSwapFree})}
            </p>
            <div className="progress progress-striped">
                <div style={{width: `${swapPercent}%`}} aria-valuemax={100} aria-valuemin={0} aria-valuenow={swapPercent} role="progressbar" className={`progress-bar ${ramcolor}`}>
                    <span className="sr-only">{swapPercent}% {i18n.t("USED")}</span>
                </div>
            </div>
        </div>);
    }

    return ReactDOMServer.renderToString(
        <div>
            <div className="row">
                {ret}
            </div>
            <hr />
            <h3>{i18n.t("TOTAL_RAM")}</h3>
            <h4 className="nomargin" dangerouslySetInnerHTML={{
                __html:`${memTotal}
                <button onclick="boxHandler(event)" data-package="mem" data-operation="clean" data-toggle="modal" data-target="#sysResponse" class="btn btn-xs btn-default pull-right">
                    ${i18n.t("CLEAR_CACHE")}
                </button>`,
            }}>
            </h4>
        </div>);
}
