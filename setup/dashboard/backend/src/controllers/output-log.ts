// SPDX-License-Identifier: GPL-3.0-or-later

import type { Request, Response } from "express";

import { readOutputLog } from "../widgets/output-log";
import { parseQueryNumber } from "./utils";

export const getOutputLog = (req: Request, res: Response) => {
    res.json(readOutputLog(
        parseQueryNumber(req.query.offset),
        parseQueryNumber(req.query.length),
    ));
};
