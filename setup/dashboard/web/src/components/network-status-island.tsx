// SPDX-License-Identifier: GPL-3.0-or-later

import React from "react";

import type { NetworkRate } from "../../../ws/src/shared/network-status-contract";
import { NetworkInterfacePlaceholder } from "./placeholder";

export function NetworkInterfaceRows({ interfaces, loaded, rates }: {
    interfaces: string[];
    loaded: boolean;
    rates: Record<string, NetworkRate>;
}) {
    if (!loaded) {
        return <NetworkInterfacePlaceholder />;
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
                        <td style={{ fontSize: "14px", fontWeight: "bold", padding: "2px 2px 2px 12px" }}>{iface}</td>
                        <td style={{ fontSize: "11px", padding: "2px 2px 2px 12px" }}>
                            <span className="text-success"><span>{rate.tx}</span></span>
                        </td>
                        <td style={{ fontSize: "11px", padding: "2px 2px 2px 12px" }}>
                            <span className="text-primary"><span>{rate.rx}</span></span>
                        </td>
                    </tr>
                );
            })}
        </>
    );
}
