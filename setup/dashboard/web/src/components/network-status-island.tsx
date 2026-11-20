// SPDX-License-Identifier: GPL-3.0-or-later

import React from "react";

import type { NetworkRate } from "../../../ws/src/shared/network-status-contract";
import { SkeletonText } from "./placeholder";

const cellPadding = "2px 2px 2px 12px";

export function NetworkInterfaceRows({ interfaces, loaded, rates }: {
    interfaces: string[];
    loaded: boolean;
    rates: Record<string, NetworkRate>;
}) {
    if (!loaded) {
        return (
            <>
                {[0, 1, 2].map((row) => (
                    <tr key={row} aria-hidden="true">
                        <td style={{ fontSize: "14px", padding: cellPadding }}><SkeletonText width="60%" /></td>
                        <td style={{ fontSize: "11px", padding: cellPadding }}><SkeletonText width="46%" /></td>
                        <td style={{ fontSize: "11px", padding: cellPadding }}><SkeletonText width="46%" /></td>
                    </tr>
                ))}
            </>
        );
    }
    if (interfaces.length === 0) {
        return (
            <tr>
                <td colSpan={3} style={{ fontSize: "11px", padding: "4px 4px 4px 12px" }}>N/A</td>
            </tr>
        );
    }
    return (
        <>
            {interfaces.map((iface) => {
                const rate = rates[iface] ?? { tx: "0B/s", rx: "0B/s" };
                return (
                    <tr key={iface}>
                        <td style={{ fontSize: "14px", fontWeight: "bold", padding: cellPadding }}>{iface}</td>
                        <td style={{ fontSize: "11px", padding: cellPadding }}>
                            <span className="text-success"><span>{rate.tx}</span></span>
                        </td>
                        <td style={{ fontSize: "11px", padding: cellPadding }}>
                            <span className="text-primary"><span>{rate.rx}</span></span>
                        </td>
                    </tr>
                );
            })}
        </>
    );
}
