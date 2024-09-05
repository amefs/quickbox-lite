/* eslint-disable camelcase */
// SPDX-License-Identifier: GPL-3.0-or-later
import fs from "fs";
import { exec } from "child_process";
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

function execAsync(cmd: string): Promise<string> {
    return new Promise((resolve, reject) => {
        exec(cmd, (error, stdout, stderr) => {
            if (error) {
                reject(error);
            }
            resolve(stdout? stdout : stderr);
        });
    });
}

/**
 * Get vnstat data.
 */
export async function getVnstatData(iface: string): Promise<ParsedVnstatData> {
    const ret = {
        hour: [] as ParsedTrafficEntry[],
        day: [] as ParsedTrafficEntry[],
        month: [] as ParsedTrafficEntry[],
        top: [] as ParsedTrafficEntry[],
        summary: {
            totalrx: 0,
            totaltx: 0,
            interface: "",
            created: 0,
        },
    } as ParsedVnstatData;

    const dataDir = "./dumps";
    const vnstatBin = "/usr/bin/vnstat";

    let vnstatData: VnstatData = {
        vnstatversion: "",
        jsonversion: "",
        interfaces: [],
    };

    if (!fs.existsSync(vnstatBin)) {
        const filePath = `${dataDir}/vnstat_dump_${iface}`;
        if (fs.existsSync(filePath)) {
            const fileData = fs.readFileSync(filePath, "utf8");
            vnstatData = JSON.parse(fileData) as VnstatData;
        }
    } else {
        vnstatData = JSON.parse(await execAsync(`${vnstatBin} --json -i ${iface}`)) as VnstatData;
    }

    const jsonVersion = vnstatData.jsonversion;
    /**
     * json version 1: All traffic values in the output are in KiB.
     * json version 2: All traffic values in the output are in bytes.
     */
    const dataCoefficient = jsonVersion === "1" ? 1024 : 1;

    // TODO: validate iface data
    let ifaceIndex = vnstatData.interfaces.findIndex(ifaceData => ifaceData.name === iface);

    if (ifaceIndex === -1) {
        ifaceIndex = 0;
    }

    const ifaceData = vnstatData.interfaces[ifaceIndex];
    const trafficData = ifaceData.traffic;

    const hourData = jsonVersion === "1" ? trafficData.hours : trafficData.hour;
    const today = ifaceData.updated.date;
    const todayHourData = hourData?.filter(hour => hour.date.year === today.year && hour.date.month === today.month && hour.date.day === today.day) ?? [];

    for (let i = 0; i < Math.min(24, todayHourData.length); i++) {
        const d = todayHourData[i];
        const hours = jsonVersion === "1" ? d.id : d.time?.hour;
        const ts = new Date(d.date.year, d.date.month as number - 1, d.date.day, hours, 0, 0);
        const diffTime = Math.min((Date.now() - ts.getTime()) / 1000, 3600); // at most one hour
        const rx = d.rx * dataCoefficient;
        const tx = d.tx * dataCoefficient;

        const hour = {
            time: ts.getTime(),
            label: ts.toLocaleTimeString("en-US", { hour: "numeric", hour12: true }),
            rx, // in bytes
            tx, // in bytes
            rx_avg: Math.round(rx / diffTime) * 8, // in bits/s
            tx_avg: Math.round(tx / diffTime) * 8, // in bits/s
        };
        ret.hour.push(hour);
    }


    const dayData = sortBy((jsonVersion === "1" ? trafficData.days : trafficData.day) ?? [],
        (d) => d.date.year * 10000 + (d.date.month??0) * 100 + (d.date.day??0));

    const displayDayLength = Math.min(30, dayData.length);
    for (let i = dayData.length - displayDayLength; i < dayData.length; i++) {
        const d = dayData[i];
        const ts = new Date(d.date.year, d.date.month as number - 1, d.date.day, 0, 0, 0);
        const diffTime = Math.min((Date.now() - ts.getTime()) / 1000, 86400); // at most one day
        const rx = d.rx * dataCoefficient;
        const tx = d.tx * dataCoefficient;

        const day = {
            time: ts.getTime(),
            label: ts.toLocaleDateString("en-US", { day: "numeric", month: "short" }),
            rx, // in bytes
            tx, // in bytes
            rx_avg: Math.round(rx / diffTime) * 8, // in bits/s
            tx_avg: Math.round(tx / diffTime) * 8, // in bits/s
        };
        ret.day.push(day);
    }

    const monthData = (jsonVersion === "1" ? trafficData.months : trafficData.month) ?? [];
    const displayMonthLength = Math.min(12, monthData.length);
    for (let i = monthData.length - displayMonthLength; i < monthData.length; i++) {
        const d = monthData[i];
        const firstDay = new Date(d.date.year, d.date.month as number - 1, 1, 0, 0, 0);
        const lastDay = new Date(d.date.year, d.date.month as number, 1, 0, 0, 0);
        const fullMonthDiff = lastDay.getTime() - firstDay.getTime();
        const diffTime = Math.min((Date.now() - firstDay.getTime()) / 1000, fullMonthDiff); // at most one month
        const rx = d.rx * dataCoefficient;
        const tx = d.tx * dataCoefficient;

        const month = {
            time: firstDay.getTime(),
            label: firstDay.toLocaleDateString("en-US", { month: "long", year: "numeric" }),
            rx, // in bytes
            tx, // in bytes
            rx_avg: Math.round(rx / diffTime) * 8, // in bits/s
            tx_avg: Math.round(tx / diffTime) * 8, // in bits/s
        };
        ret.month.push(month);
    }

    const topData = (jsonVersion === "1" ? trafficData.tops : trafficData.top) ?? [];
    for (let i = 0; i < Math.min(10, topData.length); i++) {
        const d = topData[i];
        const ts = new Date(d.date.year, d.date.month as number - 1, d.date.day, 0, 0, 0);
        const diffTime = Math.min((Date.now() - ts.getTime()) / 1000, 86400); // at most one day
        const rx = d.rx * dataCoefficient;
        const tx = d.tx * dataCoefficient;

        const top = {
            time: ts.getTime(),
            label: ts.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" }),
            rx, // in bytes
            tx, // in bytes
            rx_avg: Math.round(rx / diffTime) * 8, // in bits/s
            tx_avg: Math.round(tx / diffTime) * 8, // in bits/s
        };
        ret.top.push(top);
    }

    // summary data from old dumpdb command
    const created = ifaceData.created;
    ret.summary = {
        totalrx: trafficData.total.rx * dataCoefficient, // in bytes
        totaltx: trafficData.total.tx * dataCoefficient, // in bytes
        interface: ifaceData.name,
        created: (+new Date(created.date.year, created.date.month as number - 1, created.date.day) / 1000),
    };

    return ret;
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
