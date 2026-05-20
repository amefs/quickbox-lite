// SPDX-License-Identifier: GPL-3.0-or-later
import { existsSync, readFileSync } from "fs";

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

function getUsername() {
    let username = "";
    try {
        const masterConfigPath = "/srv/dashboard/db/master.txt";
        if (!existsSync(masterConfigPath)) {
            console.error("Quickbox-Lite user info not found");
        } else {
            const content = readFileSync(masterConfigPath, { encoding: "utf8" });
            username = content.split("\n")[0].trim();
        }
    } catch (err) {
        console.error("Failed to read Quickbox-Lite user info", err);
    }
    return username;
}

export const username = getUsername();
