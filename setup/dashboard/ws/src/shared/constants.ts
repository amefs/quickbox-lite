// SPDX-License-Identifier: GPL-3.0-or-later
import { existsSync, readFileSync } from "fs";
import path from "path";

// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export default class Constant {
    public static EVENT_CONNECTION = "connection";
    public static EVENT_DISCONNECT = "disconnect";
    public static EVENT_MESSAGE = "message";
    public static EVENT_EXEC = "exec";
    public static EVENT_I18N = "i18n";
    public static TEMPLATE_OPERATION = "$operation$";
    public static TEMPLATE_TARGET = "$target$";
    public static TEMPLATE_USERNAME = "$username$";
}

export const USERNAME_PATTERN = /^[A-Za-z0-9._-]+$/;

export function isSafeUsername(value: unknown): value is string {
    return typeof value === "string" && USERNAME_PATTERN.test(value);
}

function getUsername() {
    let username = "";
    try {
        const masterConfigPath = path.join(process.env.QUICKBOX_DASHBOARD_DB_DIR || "/srv/dashboard/db", "master.txt");
        if (!existsSync(masterConfigPath)) {
            console.error("Quickbox-Lite user info not found");
        } else {
            const content = readFileSync(masterConfigPath, { encoding: "utf8" });
            username = content.split("\n")[0].trim();
            if (username !== "" && !isSafeUsername(username)) {
                console.error("Quickbox-Lite username contains invalid characters");
                return "";
            }
        }
    } catch (err) {
        console.error("Failed to read Quickbox-Lite user info", err);
    }
    return username;
}

export const username = getUsername();
