// SPDX-License-Identifier: GPL-3.0-or-later

import type { Socket } from "socket.io";

import Constant from "../shared/constants";
import type { WsPushMode } from "../shared/bootstrap-contract";
import {
    DASHBOARD_STREAMS,
    normalizeBandwidthPage,
    type BandwidthPage,
    type DashboardStreamConfig,
} from "../shared/widget-streams";
import {
    parseWsSubscribeOptions,
    type WsSubscribeOptions,
    type WsWidgetPush,
} from "../shared/ws-message";
import { resolveWidget } from "./message";

export type { BandwidthPage, WsSubscribeOptions };

export interface PushSpec {
    key: string;
    url: string;
    visibleMs: number;
    activeVisibleMs?: number;
    hiddenMs: number;
    dedupe?: boolean;
    param?: DashboardStreamConfig["param"];
    fetch?: (page: BandwidthPage | undefined, signal: AbortSignal) => Promise<unknown>;
    timeoutMs?: number;
    fingerprint?: (data: unknown) => string;
}

export interface ClientPushState {
    client: Socket;
    mode: WsPushMode;
    bandwidthPage: BandwidthPage;
    hidden: boolean;
    lastDigest: Map<string, string>;
    lastSentAt: Map<string, number>;
}

type SampleResult = "success" | "error" | "timeout";

interface SampleStats {
    outcomes: Record<SampleResult, number>;
    lastSuccessAt: number;
}

interface SamplerMetrics extends SampleStats {
    stream: string;
    active: number;
    inFlight: number;
    failed: number;
}

interface SharedSampler {
    id: string;
    spec: PushSpec;
    stats: SampleStats;
    args?: { page: BandwidthPage };
    subscribers: Set<ClientPushState>;
    timer?: ReturnType<typeof setTimeout>;
    nextScheduledAt: number;
    inFlight?: Promise<void>;
    controller?: AbortController;
    pendingForce: boolean;
    taskActive: boolean;
    lastData?: unknown;
    lastFetchedAt: number;
    failed: boolean;
}

const SAMPLE_TIMEOUT_MS = 8_000;

function stableDigest(data: unknown): string {
    try {
        return JSON.stringify(data);
    } catch {
        return "";
    }
}

function serviceStatusDigest(data: unknown): string {
    if (!data || typeof data !== "object") {
        return "";
    }
    const record = data as {
        health?: unknown;
        states?: Record<string, { value?: unknown; stale?: unknown } | undefined>;
    };
    const compactStates: Record<string, { value: unknown; stale: boolean }> = {};
    if (record.states && typeof record.states === "object") {
        for (const [id, entry] of Object.entries(record.states)) {
            compactStates[id] = { value: entry?.value ?? null, stale: Boolean(entry?.stale) };
        }
    }
    return JSON.stringify({ health: record.health ?? "unavailable", states: compactStates });
}

const STREAM_FINGERPRINTS: Partial<Record<DashboardStreamConfig["key"], (data: unknown) => string>> = {
    SERVICE_STATUS_ALL: serviceStatusDigest,
};

const PUSH_SPECS: PushSpec[] = DASHBOARD_STREAMS.map((stream) => ({
    key: stream.key,
    url: stream.url,
    visibleMs: stream.visibleMs,
    activeVisibleMs: stream.activeVisibleMs,
    hiddenMs: stream.hiddenMs,
    dedupe: stream.dedupe,
    param: stream.param,
    ...(STREAM_FINGERPRINTS[stream.key] ? { fingerprint: STREAM_FINGERPRINTS[stream.key] } : {}),
}));

function resolveSamplerIntervalMs(sampler: SharedSampler): number {
    const anyVisible = Array.from(sampler.subscribers).some((sub) => !sub.hidden);
    if (!anyVisible) {
        return sampler.spec.hiddenMs;
    }
    if (sampler.taskActive && sampler.spec.activeVisibleMs !== undefined) {
        return sampler.spec.activeVisibleMs;
    }
    return sampler.spec.visibleMs;
}

function sendPushPayload(
    state: ClientPushState,
    sampler: SharedSampler,
    data: unknown,
    success = true,
    message = "",
    stale = false,
): void {
    state.client.send({
        type: "push",
        key: sampler.spec.key,
        url: sampler.spec.url,
        ...(sampler.args !== undefined ? { args: sampler.args } : {}),
        success,
        message,
        response: data,
        ...(stale ? { stale: true as const } : {}),
    } satisfies WsWidgetPush);
}

function deliverToSubscriber(
    state: ClientPushState,
    sampler: SharedSampler,
    data: unknown,
    digest: string | undefined,
    force: boolean,
    now: number,
): void {
    if (state.mode !== "push" || !state.client.connected) {
        return;
    }
    if (!force && state.hidden) {
        const lastSent = state.lastSentAt.get(sampler.spec.key) ?? 0;
        if (now - lastSent < sampler.spec.hiddenMs) {
            return;
        }
    }
    if (sampler.spec.dedupe && digest !== undefined) {
        const prev = state.lastDigest.get(sampler.id);
        state.lastDigest.set(sampler.id, digest);
        if (!force && prev === digest) {
            return;
        }
    }
    state.lastSentAt.set(sampler.spec.key, now);
    sendPushPayload(state, sampler, data);
}

function deliverErrorToSubscriber(state: ClientPushState, sampler: SharedSampler, now: number, force = false): void {
    if (state.mode !== "push" || !state.client.connected) {
        return;
    }
    state.lastDigest.delete(sampler.id);
    if (!force && state.hidden) {
        const lastSent = state.lastSentAt.get(sampler.spec.key) ?? 0;
        if (now - lastSent < sampler.spec.hiddenMs) {
            return;
        }
    }
    state.lastSentAt.set(sampler.spec.key, now);
    const stale = sampler.lastData !== undefined;
    sendPushPayload(state, sampler, sampler.lastData ?? "", false, "Widget render failed", stale);
}

export interface PushManager {
    pushHandler: (client: Socket, next?: (err?: Error) => void) => void;
    notifyPushSubscribers: (keys?: string[]) => void;
    resetPushSamplers: () => void;
    getActiveSamplerCount: () => number;
    getSamplerMetrics: () => SamplerMetrics[];
}

export function createPushManager(specs: PushSpec[] = PUSH_SPECS): PushManager {
    const samplers = new Map<string, SharedSampler>();
    const streams = specs.map((spec) => ({
        spec,
        stats: { outcomes: { success: 0, error: 0, timeout: 0 }, lastSuccessAt: 0 },
    }));

    function tightenSamplerSchedule(sampler: SharedSampler, now: number): void {
        if (sampler.timer === undefined || sampler.subscribers.size === 0) {
            return;
        }
        const desiredInterval = resolveSamplerIntervalMs(sampler);
        if (sampler.nextScheduledAt - now <= desiredInterval) {
            return;
        }
        const remaining = sampler.lastFetchedAt > 0
            ? Math.max(0, desiredInterval - (now - sampler.lastFetchedAt))
            : desiredInterval;
        scheduleSampler(sampler, remaining);
    }

    function runSampler(sampler: SharedSampler, force = false): Promise<void> {
        if (sampler.subscribers.size === 0) {
            return Promise.resolve();
        }
        if (sampler.inFlight) {
            if (force) {
                sampler.pendingForce = true;
            }
            return sampler.inFlight;
        }
        const controller = new AbortController();
        sampler.controller = controller;
        const reportFailure = (error: unknown, result: "error" | "timeout") => {
            sampler.failed = true;
            sampler.stats.outcomes[result] += 1;
            console.error(`[quickbox-ws] push failed for ${sampler.id}`, error);
            const now = Date.now();
            for (const subscriber of sampler.subscribers) {
                deliverErrorToSubscriber(subscriber, sampler, now, result === "timeout");
            }
        };
        const timeout = setTimeout(() => {
            if (controller.signal.aborted) {return;}
            const error = new Error("Widget collection timed out");
            controller.abort(error);
            reportFailure(error, "timeout");
        }, sampler.spec.timeoutMs ?? SAMPLE_TIMEOUT_MS);

        const task = Promise.resolve().then(async () => {
            try {
                controller.signal.throwIfAborted();
                const data = sampler.spec.fetch
                    ? await sampler.spec.fetch(sampler.args?.page, controller.signal)
                    : await resolveWidget(sampler.spec.url, sampler.args, controller.signal);
                if (controller.signal.aborted) {return;}
                if (sampler.subscribers.size === 0) {
                    return;
                }
                const prevTaskActive = sampler.taskActive;
                if (sampler.spec.key === "TASK_STATUS" && data && typeof data === "object" && "active" in data) {
                    sampler.taskActive = Boolean((data as { active?: unknown }).active);
                }
                const now = Date.now();
                sampler.failed = false;
                sampler.lastData = data;
                sampler.lastFetchedAt = now;
                const digest = sampler.spec.dedupe
                    ? (sampler.spec.fingerprint ? sampler.spec.fingerprint(data) : stableDigest(data))
                    : undefined;
                for (const subscriber of sampler.subscribers) {
                    deliverToSubscriber(subscriber, sampler, data, digest, force, now);
                }
                if (!prevTaskActive && sampler.taskActive) {
                    tightenSamplerSchedule(sampler, now);
                }
                sampler.stats.outcomes.success += 1;
                sampler.stats.lastSuccessAt = now;
            } catch (error) {
                if (!controller.signal.aborted) {reportFailure(error, "error");}
            } finally {
                clearTimeout(timeout);
                sampler.inFlight = undefined;
                sampler.controller = undefined;
                if (sampler.subscribers.size === 0) {
                    samplers.delete(sampler.id);
                } else if (sampler.pendingForce) {
                    sampler.pendingForce = false;
                    void runSampler(sampler, true);
                } else if (sampler.timer === undefined) {
                    scheduleSampler(sampler, resolveSamplerIntervalMs(sampler));
                }
            }
        });
        sampler.inFlight = task;
        return task;
    }

    function scheduleSampler(sampler: SharedSampler, delayMs: number): void {
        if (sampler.timer !== undefined) {
            clearTimeout(sampler.timer);
            sampler.timer = undefined;
            sampler.nextScheduledAt = 0;
        }
        sampler.nextScheduledAt = Date.now() + delayMs;
        sampler.timer = setTimeout(() => {
            sampler.timer = undefined;
            sampler.nextScheduledAt = 0;
            void runSampler(sampler);
        }, delayMs);
    }

    function stopIdleSampler(sampler: SharedSampler): void {
        if (sampler.timer !== undefined) {
            clearTimeout(sampler.timer);
            sampler.timer = undefined;
            sampler.nextScheduledAt = 0;
        }
        sampler.pendingForce = false;
        if (sampler.inFlight) {
            sampler.controller?.abort();
        } else {
            samplers.delete(sampler.id);
        }
    }

    function detachClientFromSamplers(state: ClientPushState): void {
        for (const sampler of samplers.values()) {
            if (sampler.subscribers.delete(state) && sampler.subscribers.size === 0) {
                stopIdleSampler(sampler);
            }
        }
    }

    function syncClientSubscriptions(state: ClientPushState, refreshKeys: "all" | "none" | Set<string>): void {
        if (state.mode !== "push" || !state.client.connected) {
            detachClientFromSamplers(state);
            return;
        }
        const desiredIds = new Set<string>();
        const now = Date.now();
        let staleScheduleIndex = 0;

        streams.forEach(({ spec, stats }, index) => {
            const page = spec.param === "bandwidthPage" ? state.bandwidthPage : undefined;
            const id = `${spec.key}:${page ?? ""}`;
            desiredIds.add(id);

            let sampler = samplers.get(id);
            const isNewSampler = !sampler;
            if (!sampler) {
                sampler = {
                    id,
                    spec,
                    stats,
                    args: page === undefined ? undefined : { page },
                    subscribers: new Set(),
                    nextScheduledAt: 0,
                    pendingForce: false,
                    taskActive: false,
                    lastFetchedAt: 0,
                    failed: false,
                };
                samplers.set(id, sampler);
            }
            const alreadySubscribed = sampler.subscribers.has(state);
            sampler.subscribers.add(state);

            const shouldRefresh = !alreadySubscribed ||
                refreshKeys === "all" ||
                (refreshKeys !== "none" && refreshKeys.has(spec.key));

            if (isNewSampler) {
                scheduleSampler(sampler, index * 40);
            } else if (shouldRefresh) {
                if (sampler.failed) {
                    deliverErrorToSubscriber(state, sampler, now, true);
                }
                if (sampler.controller?.signal.aborted) {
                    sampler.pendingForce = true;
                } else if (!sampler.failed && sampler.lastData !== undefined && now - sampler.lastFetchedAt < spec.visibleMs) {
                    const digest = spec.dedupe
                        ? (spec.fingerprint ? spec.fingerprint(sampler.lastData) : stableDigest(sampler.lastData))
                        : undefined;
                    deliverToSubscriber(state, sampler, sampler.lastData, digest, true, now);
                    tightenSamplerSchedule(sampler, now);
                } else if (!sampler.inFlight) {
                    scheduleSampler(sampler, staleScheduleIndex * 40);
                    staleScheduleIndex += 1;
                } else {
                    sampler.pendingForce = true;
                }
            } else if (!state.hidden) {
                tightenSamplerSchedule(sampler, now);
            }
        });

        for (const [id, sampler] of samplers.entries()) {
            if (!desiredIds.has(id) && sampler.subscribers.delete(state) && sampler.subscribers.size === 0) {
                stopIdleSampler(sampler);
            }
        }
    }

    function notifyPushSubscribers(keys?: string[]): void {
        const keyFilter = keys?.length ? new Set(keys) : undefined;
        for (const sampler of samplers.values()) {
            if (sampler.subscribers.size === 0) {
                continue;
            }
            if (keyFilter && !keyFilter.has(sampler.spec.key)) {
                continue;
            }
            void runSampler(sampler, true);
        }
    }

    function resetPushSamplers(): void {
        for (const sampler of samplers.values()) {
            sampler.lastData = undefined;
            sampler.lastFetchedAt = 0;
            sampler.failed = false;
            for (const subscriber of sampler.subscribers) {
                subscriber.lastDigest.delete(sampler.id);
            }
            if (sampler.subscribers.size > 0) {
                void runSampler(sampler, true);
            }
        }
    }

    function getActiveSamplerCount(): number {
        return [...samplers.values()].filter((sampler) => sampler.subscribers.size > 0).length;
    }

    function getSamplerMetrics(): SamplerMetrics[] {
        return streams.map(({ spec, stats }) => {
            const snapshot = {
                stream: spec.key,
                active: 0,
                inFlight: 0,
                failed: 0,
                lastSuccessAt: stats.lastSuccessAt,
                outcomes: { ...stats.outcomes },
            };
            for (const sampler of samplers.values()) {
                if (sampler.stats !== stats) {continue;}
                snapshot.active += Number(sampler.subscribers.size > 0);
                snapshot.inFlight += Number(sampler.inFlight !== undefined);
                snapshot.failed += Number(sampler.subscribers.size > 0 && sampler.failed);
            }
            return snapshot;
        });
    }

    function pushHandler(client: Socket, next?: (err?: Error) => void): void {
        const state: ClientPushState = {
            client,
            mode: "poll",
            bandwidthPage: "t",
            hidden: false,
            lastDigest: new Map(),
            lastSentAt: new Map(),
        };

        client.on(Constant.EVENT_WS_SUBSCRIBE, (rawOptions: unknown) => {
            const opts = parseWsSubscribeOptions(rawOptions);
            const nextMode: WsPushMode = opts.mode === "poll" ? "poll" : "push";
            const prevBandwidthPage = state.bandwidthPage;
            const prevHidden = state.hidden;
            const wasPush = state.mode === "push";

            state.mode = nextMode;
            state.bandwidthPage = normalizeBandwidthPage(opts.bandwidthPage ?? state.bandwidthPage);
            state.hidden = Boolean(opts.hidden);

            if (nextMode !== "push") {
                detachClientFromSamplers(state);
                state.lastDigest.clear();
                state.lastSentAt.clear();
                return;
            }

            if (!wasPush) {
                state.lastDigest.clear();
                state.lastSentAt.clear();
            }
            let refreshKeys: "all" | "none" | Set<string> = "none";
            if (!wasPush || (prevHidden && !state.hidden)) {
                refreshKeys = "all";
            } else if (prevBandwidthPage !== state.bandwidthPage) {
                refreshKeys = new Set(["BANDWIDTH"]);
            }
            syncClientSubscriptions(state, refreshKeys);
        });

        client.on(Constant.EVENT_DISCONNECT, () => {
            detachClientFromSamplers(state);
            state.lastDigest.clear();
            state.lastSentAt.clear();
        });

        if (next) {
            next();
        }
    }

    return {
        pushHandler,
        notifyPushSubscribers,
        resetPushSamplers,
        getActiveSamplerCount,
        getSamplerMetrics,
    };
}

const defaultPushManager = createPushManager(PUSH_SPECS);

export const notifyPushSubscribers = defaultPushManager.notifyPushSubscribers;
export const resetPushSamplers = defaultPushManager.resetPushSamplers;
export const getActiveSamplerCount = defaultPushManager.getActiveSamplerCount;
export const getSamplerMetrics = defaultPushManager.getSamplerMetrics;
export const pushHandler = defaultPushManager.pushHandler;

export default pushHandler;
