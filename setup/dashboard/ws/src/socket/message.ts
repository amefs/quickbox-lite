// SPDX-License-Identifier: GPL-3.0-or-later

import { Socket } from "socket.io";

import Constant from "../shared/constants";
import { systemLoadData } from "../services/system/load";
import { netStatus } from "../services/system/network";
import { getUptimeParts } from "../services/system/uptime";
import { diskDataData } from "../services/system/disk";
import { ramStatsData } from "../services/system/memory";
import { getIfaceConfig } from "../utils/vnstat";
import { bandwidthTablesData } from "../services/system/bandwidth";
import { serviceStatusAllData } from "../services/service/status";
import { readOutputLog } from "../services/output-log";
import { runningTaskData } from "../services/packages/running-task";
import { getServiceControlRows } from "../services/service/control";
import { getPackageManagementStateData } from "../services/packages/pmc";
import { isServiceKey, SERVICE_STREAM_URLS } from "../shared/service-control-contract";
import {
    BANDWIDTH_DATA_URL,
    DISK_DATA_URL,
    NETWORK_STATUS_URL,
    OUTPUT_LOG_URL,
    PACKAGE_MANAGEMENT_DATA_URL,
    RAM_STATS_DATA_URL,
    SERVICE_CONTROL_URL,
    SERVICE_STATUS_ALL_URL,
    SYSTEM_LOAD_DATA_URL,
    SYSTEM_UPTIME_DATA_URL,
    TASK_STATUS_DATA_URL,
    VALID_BANDWIDTH_PAGES,
    type BandwidthPage,
} from "../shared/widget-streams";
import {
    isWsWidgetRequest,
    parseLegacySshOutputRequest,
    parseOutputLogQuery,
    type WidgetArgs,
    type WsProtocolError,
    type WsWidgetReply,
} from "../shared/ws-message";

type WidgetHandler = (args: WidgetArgs, signal?: AbortSignal) => Promise<string | object> | string | object;

function parseBandwidthPage(page?: string): BandwidthPage | undefined {
    return VALID_BANDWIDTH_PAGES.includes(page as BandwidthPage) ? page as BandwidthPage : undefined;
}

const widgetHandlers: Partial<Record<string, WidgetHandler>> = {
    [NETWORK_STATUS_URL]: () => netStatus(),
    [SYSTEM_LOAD_DATA_URL]: () => systemLoadData(),
    [SYSTEM_UPTIME_DATA_URL]: () => getUptimeParts(),
    [DISK_DATA_URL]: (_, signal) => diskDataData(signal),
    [RAM_STATS_DATA_URL]: () => ramStatsData(),
    [BANDWIDTH_DATA_URL]: ({ page }, signal) => bandwidthTablesData(getIfaceConfig(), parseBandwidthPage(page), signal),
    [TASK_STATUS_DATA_URL]: () => Promise.resolve(runningTaskData()),
    [PACKAGE_MANAGEMENT_DATA_URL]: () => getPackageManagementStateData(),
    [SERVICE_CONTROL_URL]: () => ({ rows: getServiceControlRows() }),
    [SERVICE_STATUS_ALL_URL]: () => serviceStatusAllData(),
    [OUTPUT_LOG_URL]: ({ offset, length, epoch }) => readOutputLog(offset, length, epoch),
};

export const resolveWidget = async (url: string, args: WidgetArgs = {}, signal?: AbortSignal): Promise<string|object> => {
    const handler = Object.hasOwn(widgetHandlers, url) ? widgetHandlers[url] : undefined;
    if (handler) {
        return await handler(args, signal);
    }
    const outputLogArgs = parseOutputLogQuery(url);
    if (outputLogArgs) {
        return readOutputLog(
            args.offset ?? outputLogArgs.offset,
            args.length ?? outputLogArgs.length,
            args.epoch ?? outputLogArgs.epoch,
        );
    }
    throw new Error(`Unknown widget route: ${url}`);
};

const messageHandler = async (payload: unknown, client: Socket) => {
    const legacySshOutput = parseLegacySshOutputRequest(payload);
    if (legacySshOutput) {
        let response: string | object = "";
        let success = true;
        let message = "";
        try {
            response = readOutputLog(
                legacySshOutput.args.offset,
                legacySshOutput.args.length,
                legacySshOutput.args.epoch,
            );
        } catch (error) {
            console.error("[quickbox-ws] widget render failed", legacySshOutput.url, error);
            message = "Widget render failed";
            success = false;
        } finally {
            client.send({
                type: "reply",
                key: legacySshOutput.key,
                ...(legacySshOutput.requestId !== undefined ? { requestId: legacySshOutput.requestId } : {}),
                url: legacySshOutput.url,
                pathName: OUTPUT_LOG_URL,
                success,
                message,
                response,
            });
        }
        return;
    }
    if (!isWsWidgetRequest(payload) || (isServiceKey(payload.key) && payload.url !== SERVICE_STREAM_URLS[payload.key])) {
        client.send({ type: "protocol-error", message: "Invalid payload" } satisfies WsProtocolError);
        return;
    }
    let response: string | object = "";
    let success = true;
    let message = "";
    try {
        response = await resolveWidget(payload.url, payload.args);
    } catch (error) {
        console.error("[quickbox-ws] widget render failed", payload.url, error);
        message = "Widget render failed";
        success = false;
    } finally {
        client.send({
            type: "reply",
            key: payload.key,
            requestId: payload.requestId,
            url: payload.url,
            success,
            message,
            response,
        } satisfies WsWidgetReply);
    }
};

export default (client: Socket, next?: (err?: Error) => void) => {
    client.on(Constant.EVENT_MESSAGE, async payload => { await messageHandler(payload, client); });
    if (next) {
        next();
    }
};
