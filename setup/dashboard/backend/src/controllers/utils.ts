// SPDX-License-Identifier: GPL-3.0-or-later

import type { Request } from "express";

import { resolveRequestLocale, withLocale } from "../i18n";

export const renderWithRequestLocale = async <T,>(req: Request, callback: () => T | Promise<T>): Promise<T> => {
    return await withLocale(resolveRequestLocale(req), callback);
};

export const parseQueryNumber = (value: unknown) => {
    if (typeof value !== "string") {
        return undefined;
    }
    const parsed = parseInt(value, 10);
    return Number.isNaN(parsed) ? undefined : parsed;
};
