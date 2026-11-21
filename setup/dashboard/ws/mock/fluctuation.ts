// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Time-driven variation for the fixture values.
 *
 * A profile describes the average state of a simulated host. Replaying those
 * numbers verbatim freezes the dashboard: the gauges never move and the
 * traffic tables never grow, which hides exactly the behaviour a layout change
 * is supposed to exercise. The helpers here derive a smooth signal from the
 * clock instead, so a fixture behaves like a live machine while the profiles
 * stay plain data.
 *
 * Every function takes an optional `now` so tests can step the clock without
 * waiting for real time to pass.
 */

import { MOCK_HOST, type MockDisk, type MockMemory, type MockProfile } from "./data/profiles";

const STARTED_AT = Date.now();

export interface TrafficRates {
    rx: number;
    tx: number;
}

function elapsedSeconds(now: number): number {
    return Math.max(0, (now - STARTED_AT) / 1000);
}

function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
}

function round2(value: number): number {
    return Math.round(value * 100) / 100;
}

/** Stable phase offset per signal name, so unrelated gauges move apart. */
function seedPhase(seed: string): number {
    let hash = 2166136261;
    for (let index = 0; index < seed.length; index += 1) {
        hash ^= seed.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }
    return ((hash >>> 0) / 0xffffffff) * Math.PI * 2;
}

/**
 * Multiplicative drift around 1, within `1 ± amplitude`.
 *
 * Two waves with different periods keep the curve from looking like a pure
 * sine, which matters because a single period reads as an animation instead
 * of a system under load.
 */
export function drift(seed: string, amplitude: number, periodSeconds = 90, now = Date.now()): number {
    const phase = seedPhase(seed);
    const t = elapsedSeconds(now);
    const primary = Math.sin((t / periodSeconds) * Math.PI * 2 + phase);
    const secondary = Math.sin((t / (periodSeconds * 0.41)) * Math.PI * 2 + phase * 1.7);
    return 1 + amplitude * (0.7 * primary + 0.3 * secondary);
}

/** Slow position in [0, 1] on the same kind of curve. */
export function level(seed: string, periodSeconds = 120, now = Date.now()): number {
    const unit = (drift(seed, 0.55, periodSeconds, now) - 1) / 0.55;
    return clamp(0.5 + 0.5 * unit, 0, 1);
}

function hashUnit(index: number): number {
    const value = Math.sin(index * 127.1 + 311.7) * 43758.5453;
    return value - Math.floor(value);
}

/** Smooth value noise in [0, 1) that re-rolls every `stepSeconds`. */
export function noise(seed: string, stepSeconds = 9, now = Date.now()): number {
    const t = elapsedSeconds(now) / stepSeconds + seedPhase(seed) * 10;
    const index = Math.floor(t);
    const fraction = t - index;
    const eased = fraction * fraction * (3 - 2 * fraction);
    return hashUnit(index) * (1 - eased) + hashUnit(index + 1) * eased;
}

/** Rate baseline of the primary interface, falling back to the host defaults. */
export function baselineRates(profile: MockProfile): TrafficRates {
    return {
        rx: profile.rxPerSecond ?? MOCK_HOST.rxPerSecond,
        tx: profile.txPerSecond ?? MOCK_HOST.txPerSecond,
    };
}

/**
 * Bursty rate between 10% and 210% of the baseline. The noise term supplies
 * short spikes, the slow term moves the average so a long session does not
 * hover around the same value.
 */
export function networkRate(seed: string, baseline: number, now = Date.now()): number {
    const burst = 0.55 * noise(seed, 7, now) + 0.45 * level(`${seed}:slow`, 95, now);
    return Math.max(0, baseline * (0.1 + 2 * burst));
}

const counters = new Map<string, { rx: number; tx: number; at: number; rates: TrafficRates }>();

export interface TrafficCounters {
    /** Bytes since the fixture baseline. */
    total: TrafficRates;
    /** Bytes since the previous call, which is what a bucket has to add. */
    delta: TrafficRates;
}

/**
 * Advances the cumulative byte counters by the rate that was in effect since
 * the previous call, so the totals only ever grow and match the reported
 * per-second values.
 */
export function trafficCounters(
    key: string,
    base: TrafficRates,
    rates: TrafficRates,
    now = Date.now(),
): TrafficCounters {
    const previous = counters.get(key) ?? { rx: base.rx, tx: base.tx, at: now, rates };
    const seconds = Math.max(0, (now - previous.at) / 1000);
    const rx = previous.rx + previous.rates.rx * seconds;
    const tx = previous.tx + previous.rates.tx * seconds;
    counters.set(key, { rx, tx, at: now, rates });
    return {
        total: { rx: Math.round(rx), tx: Math.round(tx) },
        delta: {
            rx: Math.round(rx - previous.rx),
            tx: Math.round(tx - previous.tx),
        },
    };
}

/** Drops the accumulated counters, e.g. when the active profile changes. */
export function resetFluctuation(): void {
    counters.clear();
}

/**
 * Memory always adds up: `used + free === total`, `available` includes the
 * reclaimable cache, and the swap figures stay consistent. The used ratio
 * swings wide enough to cross the warning and danger thresholds, which is what
 * makes the colour changes reviewable.
 */
export function fluctuateMemory(memory: MockMemory, now = Date.now()): MockMemory {
    const total = memory.total;
    const baseRatio = total > 0 ? memory.used / total : 0.5;
    const ratio = clamp(baseRatio * drift("memory:used", 0.16, 110, now), 0.05, 0.96);
    const used = Math.round(total * ratio);
    const free = Math.max(0, total - used);
    const buffcache = Math.min(free, Math.round(memory.buffcache * drift("memory:cache", 0.2, 140, now)));
    const buffers = Math.min(buffcache, Math.round(buffcache * 0.18));
    const swapused = Math.min(
        memory.swaptotal,
        Math.round(memory.swapused * drift("memory:swap", 0.3, 200, now)),
    );
    return {
        ...memory,
        total,
        used,
        free,
        active: Math.max(0, used - buffcache),
        available: Math.min(total, free + buffcache),
        buffcache,
        buffers,
        cached: buffcache - buffers,
        swapused,
        swapfree: Math.max(0, memory.swaptotal - swapused),
    };
}

/**
 * The one-minute average swings most, the fifteen-minute average least, which
 * is how a real load average behaves.
 */
export function fluctuateLoad(
    loadavg: [number, number, number],
    now = Date.now(),
): [number, number, number] {
    const [one, five, fifteen] = loadavg;
    return [
        round2(one * drift("load:1m", 0.42, 45, now)),
        round2(five * drift("load:5m", 0.26, 85, now)),
        round2(fifteen * drift("load:15m", 0.14, 160, now)),
    ];
}

/**
 * Disk usage drifts slowly: a filesystem that jumps gigabytes between two
 * refreshes reads as a bug, not as activity.
 */
export function fluctuateDisks(disks: MockDisk[], now = Date.now()): MockDisk[] {
    return disks.map((disk, index) => {
        const baseRatio = disk.size > 0 ? disk.used / disk.size : 0;
        const ratio = clamp(
            baseRatio * drift(`disk:used:${disk.mount}:${index}`, 0.08, 200, now),
            0.02,
            0.98,
        );
        const used = Math.round(disk.size * ratio);
        const available = Math.max(0, disk.size - used);
        return {
            ...disk,
            used,
            available,
            use: round2((used / disk.size) * 100),
        };
    });
}

interface VnstatTrafficRow {
    rx?: number;
    tx?: number;
}

interface VnstatTraffic {
    total?: VnstatTrafficRow;
    hour?: VnstatTrafficRow[];
    day?: VnstatTrafficRow[];
    month?: VnstatTrafficRow[];
}

interface VnstatFile {
    interfaces?: { traffic?: VnstatTraffic }[];
}

function addTraffic(row: VnstatTrafficRow | undefined, delta: TrafficRates): void {
    if (!row) {
        return;
    }
    row.rx = (row.rx ?? 0) + delta.rx;
    row.tx = (row.tx ?? 0) + delta.tx;
}

/**
 * Rewrites a vnstat dump so the totals and the newest hour/day/month buckets
 * keep growing. The fixtures are plain JSON, so the growth is applied on every
 * read; nothing needs to be written back to disk.
 */
export function fluctuateVnstat(
    json: string,
    key: string,
    rates: TrafficRates,
    now = Date.now(),
): string {
    let payload: VnstatFile;
    try {
        payload = JSON.parse(json) as VnstatFile;
    } catch {
        return json;
    }
    const traffic = payload.interfaces?.[0]?.traffic;
    if (!traffic) {
        return json;
    }
    const advanced = trafficCounters(
        key,
        { rx: 0, tx: 0 },
        { rx: rates.rx, tx: rates.tx },
        now,
    );
    addTraffic(traffic.total, advanced.delta);
    addTraffic(traffic.hour?.at(-1), advanced.delta);
    addTraffic(traffic.day?.at(-1), advanced.delta);
    addTraffic(traffic.month?.at(-1), advanced.delta);
    return JSON.stringify(payload);
}
