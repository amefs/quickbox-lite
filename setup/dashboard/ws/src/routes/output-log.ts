// SPDX-License-Identifier: GPL-3.0-or-later

import { Router, type Request, type Response } from "express";
import { readOutputLog } from "../services/output-log";
import { parseQueryNumber } from "./utils";

export const getOutputLog = (req: Request, res: Response) => {
    res.json(readOutputLog(
        parseQueryNumber(req.query.offset),
        parseQueryNumber(req.query.length),
        typeof req.query.epoch === "string" ? req.query.epoch : undefined,
    ));
};

/**
 * Output log sub-router (mounted at `/db`).
 *
 * Routes:
 *   GET /output.log
 */
export function createOutputLogRouter(): Router {
    const router = Router();
    router.get("/output.log", getOutputLog);
    return router;
}
