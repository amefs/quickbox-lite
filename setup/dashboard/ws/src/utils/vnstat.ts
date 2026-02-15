/* eslint-disable camelcase */
// SPDX-License-Identifier: GPL-3.0-or-later
import fs from "fs";
import { execFile } from "child_process";
import { sortBy } from "lodash";

interface VnstatData {
    vnstatversion: string;
    jsonversion: string;
    interfaces: InterfaceData[];
}

interface InterfaceData {
    name: string;
    alias?: string;
    created: DateTimeData;
    updated: DateTimeData;
    traffic: TrafficData;
}

interface DateTimeData {
    date: DateData;
    time: TimeData;
}

interface DateData {
    year: number;
    month?: number;
    day?: number;
}

interface TimeData {
    hour: number;
    minute: number;
}

interface TrafficData {
    total: {
        rx: number;
        tx: number;
    };
    fiveminute: TrafficEntry[];
    hours?: TrafficEntry[]; // v1
    days?: TrafficEntry[]; // v1
    months?: TrafficEntry[]; // v1
    tops: TrafficEntry[]; // v1
    hour?: TrafficEntry[]; // v2
    day?: TrafficEntry[]; // v2
    month?: TrafficEntry[]; // v2
    top?: TrafficEntry[]; // v2
}

interface TrafficEntry {
    id: number;
    date: DateData;
    time?: TimeData;
    rx: number;
    tx: number;
}

export interface ParsedTrafficEntry {
    time: number;
    label: string;
    rx: number;
    tx: number;
    rx_avg: number;
    tx_avg: number;
}

interface ParsedSummayEntry {
    totalrx: number;
    totaltx: number;
    interface: string;
    created: number;
}

export interface ParsedVnstatData {
    hour: ParsedTrafficEntry[];
    day: ParsedTrafficEntry[];
    month: ParsedTrafficEntry[];
    top: ParsedTrafficEntry[];
    summary: ParsedSummayEntry;
}

const DATA_DIR = "./dumps";
const VNSTAT_BIN = "/usr/bin/vnstat";

const createEmptyDataset = (iface: string): ParsedVnstatData => ({
    hour: [],
    day: [],
    month: [],
    top: [],
    summary: {
        totalrx: 0,
        totaltx: 0,
        interface: iface,
        created: Math.floor(Date.now() / 1000),
    },
});

async function loadVnstatData(iface: string): Promise<VnstatData | undefined> {
    if (!fs.existsSync(VNSTAT_BIN)) {
        const filePath = `${DATA_DIR}/vnstat_dump_${iface}`;
        if (fs.existsSync(filePath)) {
            const fileData = fs.readFileSync(filePath, "utf8");
            return JSON.parse(fileData) as VnstatData;
        }
        return undefined;
    }
    return JSON.parse(await execAsync(VNSTAT_BIN, ["--json", "-i", iface])) as VnstatData;
}

const selectInterface = (vnstatData: VnstatData, iface: string) =>
    vnstatData.interfaces.find(ifaceData => ifaceData.name === iface) ?? vnstatData.interfaces[0];

/**
 * json version 1: All traffic values in the output are in KiB.
 * json version 2: All traffic values in the output are in bytes.
 */
const calcDataCoefficient = (jsonVersion: string) => jsonVersion === "1" ? 1024 : 1;

const buildHourEntries = (
    trafficData: TrafficData,
    jsonVersion: string,
    updated: DateTimeData,
    dataCoefficient: number,
): ParsedTrafficEntry[] => {
    const hourData = jsonVersion === "1" ? trafficData.hours : trafficData.hour;
    if (!hourData?.length) {
        return [];
    }
    const today = updated.date;
    const todayHourData = hourData.filter(hour =>
        hour.date.year === today.year && hour.date.month === today.month && hour.date.day === today.day);
    const limit = Math.min(24, todayHourData.length);
    const result: ParsedTrafficEntry[] = [];
    for (let i = 0; i < limit; i++) {
        const d = todayHourData[i];
        const hours = jsonVersion === "1" ? d.id : d.time?.hour;
        const ts = new Date(d.date.year, (d.date.month as number) - 1, d.date.day, hours ?? 0, 0, 0);
        const diffTime = Math.min((Date.now() - ts.getTime()) / 1000, 3600); // at most one hour
        const rx = d.rx * dataCoefficient;
        const tx = d.tx * dataCoefficient;

        result.push({
            time: ts.getTime(),
            label: ts.toLocaleTimeString("en-US", { hour: "numeric", hour12: true }),
            rx, // in bytes
            tx, // in bytes
            rx_avg: Math.round(rx / diffTime) * 8, // in bits/s
            tx_avg: Math.round(tx / diffTime) * 8, // in bits/s
        });
    }
    return result;
};

const buildDayEntries = (trafficData: TrafficData, jsonVersion: string, dataCoefficient: number) => {
    const dayData = sortBy((jsonVersion === "1" ? trafficData.days : trafficData.day) ?? [],
        (d) => d.date.year * 10000 + (d.date.month ?? 0) * 100 + (d.date.day ?? 0));
    const result: ParsedTrafficEntry[] = [];
    const displayDayLength = Math.min(30, dayData.length);
    for (let i = dayData.length - displayDayLength; i < dayData.length; i++) {
        if (i < 0) {
            continue;
        }
        const d = dayData[i];
        const ts = new Date(d.date.year, (d.date.month as number) - 1, d.date.day, 0, 0, 0);
        const diffTime = Math.min((Date.now() - ts.getTime()) / 1000, 86400); // at most one day
        const rx = d.rx * dataCoefficient;
        const tx = d.tx * dataCoefficient;

        result.push({
            time: ts.getTime(),
            label: ts.toLocaleDateString("en-US", { day: "numeric", month: "short" }),
            rx, // in bytes
            tx, // in bytes
            rx_avg: Math.round(rx / diffTime) * 8, // in bits/s
            tx_avg: Math.round(tx / diffTime) * 8, // in bits/s
        });
    }
    return result;
};

const buildMonthEntries = (trafficData: TrafficData, jsonVersion: string, dataCoefficient: number) => {
    const monthData = (jsonVersion === "1" ? trafficData.months : trafficData.month) ?? [];
    const result: ParsedTrafficEntry[] = [];
    const displayMonthLength = Math.min(12, monthData.length);
    for (let i = monthData.length - displayMonthLength; i < monthData.length; i++) {
        if (i < 0) {
            continue;
        }
        const d = monthData[i];
        const firstDay = new Date(d.date.year, (d.date.month as number) - 1, 1, 0, 0, 0);
        const lastDay = new Date(d.date.year, d.date.month as number, 1, 0, 0, 0);
        const fullMonthDiff = lastDay.getTime() - firstDay.getTime();
        const diffTime = Math.min((Date.now() - firstDay.getTime()) / 1000, fullMonthDiff); // at most one month
        const rx = d.rx * dataCoefficient;
        const tx = d.tx * dataCoefficient;

        result.push({
            time: firstDay.getTime(),
            label: firstDay.toLocaleDateString("en-US", { month: "long", year: "numeric" }),
            rx, // in bytes
            tx, // in bytes
            rx_avg: Math.round(rx / diffTime) * 8, // in bits/s
            tx_avg: Math.round(tx / diffTime) * 8, // in bits/s
        });
    }
    return result;
};

const buildTopEntries = (trafficData: TrafficData, jsonVersion: string, dataCoefficient: number) => {
    const topData = (jsonVersion === "1" ? trafficData.tops : trafficData.top) ?? [];
    const result: ParsedTrafficEntry[] = [];
    for (let i = 0; i < Math.min(10, topData.length); i++) {
        const d = topData[i];
        const ts = new Date(d.date.year, (d.date.month as number) - 1, d.date.day, 0, 0, 0);
        const diffTime = Math.min((Date.now() - ts.getTime()) / 1000, 86400);
        const rx = d.rx * dataCoefficient;
        const tx = d.tx * dataCoefficient;

        result.push({
            time: ts.getTime(),
            label: ts.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" }),
            rx, // in bytes
            tx, // in bytes
            rx_avg: Math.round(rx / diffTime) * 8, // in bits/s
            tx_avg: Math.round(tx / diffTime) * 8, // in bits/s
        });
    }
    return result;
};

// summary data from old dumpdb command
const buildSummary = (trafficData: TrafficData, ifaceData: InterfaceData, dataCoefficient: number): ParsedSummayEntry => {
    const created = ifaceData.created;
    return {
        totalrx: trafficData.total.rx * dataCoefficient, // in bytes
        totaltx: trafficData.total.tx * dataCoefficient, // in bytes
        interface: ifaceData.name,
        created: (+new Date(created.date.year, (created.date.month as number) - 1, created.date.day) / 1000),
    };
};

function execAsync(cmd: string, args: string[]): Promise<string> {
    return new Promise<string>((resolve, reject) => {
        execFile(cmd, args, (error, stdout, stderr) => {
            if (error) {
                reject(error as Error);
                return;
            }
            if (stderr) {
                reject(new Error(stderr));
                return;
            }
            resolve(stdout);
        });
    });
}

/**
 * Get vnstat data.
 */
export async function getVnstatData(iface: string): Promise<ParsedVnstatData> {
    const vnstatData = await loadVnstatData(iface);
    if (!vnstatData || vnstatData.interfaces.length === 0) {
        console.warn(`vnstat data for interface '${iface}' is empty, return blank dataset`);
        return createEmptyDataset(iface);
    }

    const ifaceData = selectInterface(vnstatData, iface);

    const jsonVersion = vnstatData.jsonversion;
    const dataCoefficient = calcDataCoefficient(jsonVersion);
    const trafficData = ifaceData.traffic;

    return {
        hour: buildHourEntries(trafficData, jsonVersion, ifaceData.updated, dataCoefficient),
        day: buildDayEntries(trafficData, jsonVersion, dataCoefficient),
        month: buildMonthEntries(trafficData, jsonVersion, dataCoefficient),
        top: buildTopEntries(trafficData, jsonVersion, dataCoefficient),
        summary: buildSummary(trafficData, ifaceData, dataCoefficient),
    };
}

export function getIfaceConfig() {
    const configPath = "/srv/dashboard/db/interface.txt";
    if (!fs.existsSync(configPath)) {
        console.error("Interface info not found, use eth0 instead");
        return "eth0";
    }
    const config = fs.readFileSync(configPath, "utf8");
    return config.trim();
}
