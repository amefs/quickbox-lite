// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Text output of the commands and procfs files the dashboard reads directly.
 *
 * Fixtures describe the host, but a few collectors bypass `systeminformation`:
 * disk usage runs `df`, network counters prefer `/proc/net/dev`. Rendering the
 * fixture into the real text format keeps those collectors unchanged and makes
 * the mock behave like a Linux host on any development machine.
 */

import type { MockDisk } from "./data/profiles";

const BLOCK_SIZE = 1024;

function blocks(bytes: number): number {
    return Math.max(0, Math.round(bytes / BLOCK_SIZE));
}

/**
 * `df -kPT` (Linux, has a Type column) or `df -kP` (macOS) output. Capacities
 * are printed in 1024-byte blocks, which is what both parsers expect.
 */
export function dfOutput(disks: MockDisk[], args: string[]): string {
    const withType = args.some((argument) => argument.includes("T"));
    const lines = withType
        ? ["Filesystem Type 1024-blocks Used Available Capacity Mounted on"]
        : ["Filesystem 1024-blocks Used Available Capacity Mounted on"];
    for (const disk of disks) {
        const size = blocks(disk.size);
        const used = blocks(disk.used);
        const available = blocks(disk.available);
        const capacity = `${Math.round(disk.use)}%`;
        lines.push(withType
            ? `${disk.fs} ${disk.type} ${size} ${used} ${available} ${capacity} ${disk.mount}`
            : `${disk.fs} ${size} ${used} ${available} ${capacity} ${disk.mount}`);
    }
    return `${lines.join("\n")}\n`;
}

export interface ProcNetDevice {
    iface: string;
    rx_bytes: number;
    tx_bytes: number;
}

/** `/proc/net/dev`, the counter source the network collector prefers. */
export function procNetDev(devices: ProcNetDevice[]): string {
    const lines = [
        "Inter-|   Receive                                                |  Transmit",
        " face |bytes    packets errs drop fifo frame compressed multicast|bytes    packets errs drop fifo colls carrier compressed",
    ];
    for (const device of devices) {
        const counters = Array.from({ length: 16 }, () => "0");
        counters[0] = String(Math.round(device.rx_bytes));
        counters[8] = String(Math.round(device.tx_bytes));
        lines.push(`  ${device.iface}: ${counters.join(" ")}`);
    }
    return `${lines.join("\n")}\n`;
}
