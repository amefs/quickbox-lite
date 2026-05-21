// SPDX-License-Identifier: GPL-3.0-or-later

import Constant from "../shared/constants";
import { Socket } from "socket.io";
import { parseLocale } from "../i18n";

interface LocaleSocketData {
    locale?: string;
}

function localeData(client: Socket): LocaleSocketData {
    return (client as unknown as { data: LocaleSocketData }).data;
}

export default (client: Socket, next?: (err?: Error) => void) => {
    client.on(Constant.EVENT_I18N, (locale) => {
        const normalizedLocale = parseLocale(locale);
        if (normalizedLocale) {
            console.log(`${client.id} set lang as ${normalizedLocale}`);
            localeData(client).locale = normalizedLocale;
        }
    });
    if (next) {
        next();
    }
};
