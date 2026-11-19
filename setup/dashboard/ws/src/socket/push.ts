// SPDX-License-Identifier: GPL-3.0-or-later

import type { Socket } from "socket.io";

import Constant from "../shared/constants";
import type { WsPushMode } from "../shared/bootstrap-contract";
import {
    DASHBOARD_STREAMS,
    buildStreamUrl,
    normalizeBandwidthPage,
    type BandwidthPage,
    type DashboardStreamConfig,
} from "../shared/widget-streams";
import { createWsMessageEnvelope } from "../shared/ws-message";
import { resolveWidget } from "./message";

export type { BandwidthPage };

export interface WsSubscribeOptions {
    mode?: WsPushMode;
    bandwidthPage?: BandwidthPage;
    hidden?: boolean;
}

export interface PushSpec {
    key: string;
    url: string;
    urlTemplate?: string;
    visibleMs: number;
    activeVisibleMs?: number;
    hiddenMs: number;
    dedupe?: boolean;
    paramKey?: (state: ClientPushState) => string;
    fetch?: (param: string) => Promise<unknown>;
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

interface SharedSampler {
    id: string;
    spec: PushSpec;
    param: string;
    subscribers: Set<ClientPushState>;
    timer?: ReturnType<typeof setTimeout>;
    nextScheduledAt: number;
    inFlight?: Promise<void>;
    pendingForce: boolean;
    taskActive: boolean;
    lastData?: unknown;
    lastFetchedAt: number;
}

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
    urlTemplate: stream.urlTemplate,
    visibleMs: stream.visibleMs,
    activeVisibleMs: stream.activeVisibleMs,
    hiddenMs: stream.hiddenMs,
    dedupe: stream.dedupe,
    ...(stream.param === "bandwidthPage" ? { paramKey: (state: ClientPushState) => state.bandwidthPage } : {}),
    ...(STREAM_FINGERPRINTS[stream.key] ? { fingerprint: STREAM_FINGERPRINTS[stream.key] } : {}),
}));

function getSamplerId(spec: PushSpec, param: string): string {
    return `${spec.key}:${param}`;
}

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

function buildPushUrl(spec: PushSpec, param: string): string {
    return buildStreamUrl(spec, param);
}

function sendPushPayload(
    state: ClientPushState,
    spec: PushSpec,
    param: string,
    data: unknown,
    success = true,
    message = "",
): void {
    state.client.send(createWsMessageEnvelope({
        push: true,
        key: spec.key,
        url: buildPushUrl(spec, param),
        pathName: spec.url,
        success,
        message,
        response: data,
    }));
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
    sendPushPayload(state, sampler.spec, sampler.param, data);
}

function deliverErrorToSubscriber(state: ClientPushState, sampler: SharedSampler, now: number): void {
    if (state.mode !== "push" || !state.client.connected) {
        return;
    }
    state.lastDigest.delete(sampler.id);
    if (state.hidden) {
        const lastSent = state.lastSentAt.get(sampler.spec.key) ?? 0;
        if (now - lastSent < sampler.spec.hiddenMs) {
            return;
        }
    }
    state.lastSentAt.set(sampler.spec.key, now);
    sendPushPayload(state, sampler.spec, sampler.param, "", false, "Widget render failed");
}

export interface PushManager {
    pushHandler: (client: Socket, next?: (err?: Error) => void) => void;
    notifyPushSubscribers: (keys?: string[]) => void;
    getActiveSamplerCount: () => number;
}

export function createPushManager(specs: PushSpec[] = PUSH_SPECS): PushManager {
    const samplers = new Map<string, SharedSampler>();

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
        const task = (async () => {
            try {
                const data = sampler.spec.fetch
                    ? await sampler.spec.fetch(sampler.param)
                    : await resolveWidget(buildPushUrl(sampler.spec, sampler.param));
                if (sampler.subscribers.size === 0) {
                    return;
                }
                const prevTaskActive = sampler.taskActive;
                if (sampler.spec.key === "TASK_STATUS" && data && typeof data === "object" && "active" in data) {
                    sampler.taskActive = Boolean((data as { active?: unknown }).active);
                }
                const now = Date.now();
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
            } catch (error) {
                console.error(`[quickbox-ws] push failed for ${sampler.id}`, error);
                const now = Date.now();
                for (const subscriber of sampler.subscribers) {
                    deliverErrorToSubscriber(subscriber, sampler, now);
                }
            } finally {
                sampler.inFlight = undefined;
                if (sampler.pendingForce && sampler.subscribers.size > 0) {
                    sampler.pendingForce = false;
                    void runSampler(sampler, true);
                }
            }
        })();
        sampler.inFlight = task;
        return task;
    }

    function scheduleSampler(sampler: SharedSampler, delayMs: number): void {
        if (sampler.timer !== undefined) {
            clearTimeout(sampler.timer);
            sampler.timer = undefined;
            sampler.nextScheduledAt = 0;
        }
        if (sampler.subscribers.size === 0) {
            samplers.delete(sampler.id);
            return;
        }
        sampler.nextScheduledAt = Date.now() + delayMs;
        sampler.timer = setTimeout(() => {
            sampler.timer = undefined;
            sampler.nextScheduledAt = 0;
            if (sampler.subscribers.size === 0) {
                samplers.delete(sampler.id);
                return;
            }
            void runSampler(sampler).finally(() => {
                if (sampler.timer === undefined && sampler.subscribers.size > 0) {
                    scheduleSampler(sampler, resolveSamplerIntervalMs(sampler));
                }
            });
        }, delayMs);
    }

    function detachClientFromSamplers(state: ClientPushState): void {
        for (const [id, sampler] of samplers.entries()) {
            if (!sampler.subscribers.delete(state)) {
                continue;
            }
            if (sampler.subscribers.size === 0) {
                if (sampler.timer !== undefined) {
                    clearTimeout(sampler.timer);
                    sampler.timer = undefined;
                    sampler.nextScheduledAt = 0;
                }
                sampler.pendingForce = false;
                samplers.delete(id);
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

        specs.forEach((spec, index) => {
            const param = spec.paramKey ? spec.paramKey(state) : "";
            const id = getSamplerId(spec, param);
            desiredIds.add(id);

            let sampler = samplers.get(id);
            const isNewSampler = !sampler;
            if (!sampler) {
                sampler = {
                    id,
                    spec,
                    param,
                    subscribers: new Set(),
                    nextScheduledAt: 0,
                    pendingForce: false,
                    taskActive: false,
                    lastFetchedAt: 0,
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
                if (sampler.lastData !== undefined && now - sampler.lastFetchedAt < spec.visibleMs) {
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
                if (sampler.timer !== undefined) {
                    clearTimeout(sampler.timer);
                    sampler.timer = undefined;
                    sampler.nextScheduledAt = 0;
                }
                sampler.pendingForce = false;
                samplers.delete(id);
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

    function getActiveSamplerCount(): number {
        return samplers.size;
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
            const opts = rawOptions && typeof rawOptions === "object"
                ? (rawOptions as WsSubscribeOptions)
                : {};
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
        getActiveSamplerCount,
    };
}

const defaultPushManager = createPushManager(PUSH_SPECS);

export const notifyPushSubscribers = defaultPushManager.notifyPushSubscribers;
export const getActiveSamplerCount = defaultPushManager.getActiveSamplerCount;
export const pushHandler = defaultPushManager.pushHandler;

export default pushHandler;
