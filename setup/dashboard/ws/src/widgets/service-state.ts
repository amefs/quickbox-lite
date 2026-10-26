// SPDX-License-Identifier: GPL-3.0-or-later
import { spawn } from "child_process";
import si from "systeminformation";
import { serviceMap } from "../info";
import { getMockSystemdServiceActive } from "../testing/mock-adapter";

export interface ServiceState {
    value: boolean | null;
    observedAt: number | null;
    stale: boolean;
}
export type ServiceSnapshot = Record<string, ServiceState>;
type Branch = "systemd" | "process";
interface ServiceValue { value: boolean; observedAt: number }
interface BranchValue { values: Map<string, ServiceValue>; stale: false }
interface BranchCache { value?: BranchValue; promise?: Promise<void>; inFlightDeadline: number; failures: number; retryAt: number; failed: boolean; partialFailed: boolean; generation: number; refreshedAt: number; refreshTimer?: NodeJS.Timeout }

const systemd: BranchCache = { failures: 0, retryAt: 0, failed: false, partialFailed: false, generation: 0, refreshedAt: 0, inFlightDeadline: 0 };
const processes: BranchCache = { failures: 0, retryAt: 0, failed: false, partialFailed: false, generation: 0, refreshedAt: 0, inFlightDeadline: 0 };
const TTL = 2000;
const timeoutMs = 2000;
const responseBudgetMs = 2500;
let commandSpawner: typeof spawn = spawn;
const maxOutput = 2 * 1024 * 1024;
interface ServiceStateCollectors {
    systemd: () => Promise<Map<string, boolean>>;
    process: () => Promise<Map<string, boolean>>;
}
let collectorOverrides: ServiceStateCollectors | undefined;
const isMock = () => process.env.NODE_ENV === "test" && process.env.MOCK_ENABLED === "1";
const debug = (message: string) => { if (process.env.QUICKBOX_SERVICE_STATUS_DEBUG === "1") {console.debug(message);} };

function logTransition(name: Branch, cache: BranchCache, error?: string, durationMs = 0) {
    if (!cache.failed) {console.warn(`[service-status] ${name} collection failed (${error ?? "unknown"}, ${durationMs}ms)`);}
    else if (cache.failures === 5 || cache.failures === 10 || cache.failures === 20) {console.warn(`[service-status] ${name} collection still failing (${error ?? "unknown"}; ${cache.failures} failures, ${durationMs}ms)`);}
    cache.failed = true;
}
function run(file: string, args: string[], max = maxOutput): Promise<{ stdout: string; code: number | null }> {
    return new Promise((resolve, reject) => {
        const child = commandSpawner(file, args, { shell: false, stdio: ["ignore", "pipe", "ignore"] });
        let stdout = "";
        let settled = false;
        let timeoutError: Error | undefined;
        let killTimer: NodeJS.Timeout | undefined;
        const finishError = (error: Error) => { if (!settled) { settled = true; reject(error); } };
        const timeout = setTimeout(() => {
            clearTimeout(timeout);
            child.kill("SIGTERM");
            if (killTimer) {clearTimeout(killTimer);}
            killTimer = setTimeout(() => child.kill("SIGKILL"), 250);
            timeoutError = Object.assign(new Error("timeout"), { code: "ETIMEDOUT" });
        }, timeoutMs);
        child.stdout.on("data", (chunk: Buffer) => {
            if (timeoutError) {return;}
            if (stdout.length + chunk.length > max) {
                stdout = "";
                clearTimeout(timeout);
                child.kill("SIGTERM");
                if (killTimer) {clearTimeout(killTimer);}
                killTimer = setTimeout(() => child.kill("SIGKILL"), 250);
                timeoutError = Object.assign(new Error("output-limit"), { code: "MAXBUFFER" });
                return;
            }
            stdout += chunk.toString("utf8");
        });
        child.on("error", (err) => { clearTimeout(timeout); if (killTimer) {clearTimeout(killTimer);} finishError(err); });
        child.on("close", (code) => { clearTimeout(timeout); if (killTimer) {clearTimeout(killTimer);} if (timeoutError) {finishError(timeoutError);} else if (!settled) { settled = true; resolve({ stdout, code }); } });
    });
}
function normUnit(unit: string) { return /\.(service|socket|target|timer|path|mount|automount|swap|device|slice|scope)$/.test(unit) ? unit : `${unit}.service`; }

async function collectSystemd() {
    if (collectorOverrides) {return collectorOverrides.systemd();}
    const requested = [...new Set([...serviceMap.values()].flatMap(x => x.systemdUnit ? [normUnit(x.systemdUnit)] : []))];
    if (!requested.length) {return new Map<string, boolean>();}
    const startedAt = Date.now();
    if (isMock()) {
        const values = new Map<string, boolean>();
        for (const [key, info] of serviceMap) {
            if (info.systemdUnit) {values.set(key, getMockSystemdServiceActive(key));}
        }
        debug(`[service-status] systemd collection ${Date.now() - startedAt}ms (mock)`);
        return values;
    }
    const { stdout, code } = await run("systemctl", ["show", "--property=Id,Names,LoadState,ActiveState", ...requested]);
    const values = parseSystemdShow(stdout, requested, code);
    debug(`[service-status] systemd collection ${Date.now() - startedAt}ms (${values.size}/${requested.length} records)`);
    return values;
}
export function parseSystemdShow(stdout: string, requested: string[], code: number | null) {
    const records = stdout.split(/\n\s*\n/).filter(x => x.trim()).map(block => {
        const props = new Map(block.split(/\r?\n/).map(line => { const n = line.indexOf("="); return [line.slice(0, n), line.slice(n + 1)]; }));
        return { id: props.get("Id") ?? "", names: (props.get("Names") ?? "").split(/\s+/), load: props.get("LoadState"), active: props.get("ActiveState") };
    });
    const values = new Map<string, boolean>();
    for (const unit of requested) {
        const record = records.find(r => normUnit(r.id) === unit || r.names.some(n => normUnit(n) === unit));
        if (record?.load === "not-found") {values.set(unit, false);}
        else if (record?.load && ["loaded", "masked", "masked-runtime", "stub", "merged"].includes(record.load) && record.active && ["active", "inactive", "failed", "activating", "deactivating", "reloading", "maintenance", "refreshing"].includes(record.active)) {
            values.set(unit, record.active === "active");
        }
    }
    if (code !== 0 && values.size === 0) {throw new Error("systemctl-error");}
    return values;
}
async function collectProcesses() {
    if (collectorOverrides) {return collectorOverrides.process();}
    const startedAt = Date.now();
    if (isMock()) {
        const list = (await si.processes()).list;
        const entries = list.map(p => ({ user: p.user, args: `${p.name} ${p.params}` }));
        const result = new Map<string, boolean>();
        for (const [key, detail] of serviceMap) {if (!detail.systemdUnit && detail.process) {result.set(key, processMatches(entries, detail.process, detail.username, detail.params));}}
        debug(`[service-status] process collection ${Date.now() - startedAt}ms (mock)`);
        return result;
    }
    const { stdout, code } = await run("ps", ["-eo", "user:128=,args="]);
    if (code !== 0) {throw new Error("ps-error");}
    const entries = stdout.split(/\r?\n/).map(line => {
        const match = line.trim().match(/^(\S+)\s+(.*)$/);
        return match ? { user: match[1], args: match[2] } : null;
    }).filter((x): x is { user: string; args: string } => x !== null);
    if (entries.length === 0) {throw new Error("ps-empty");}
    const result = new Map<string, boolean>();
    for (const [key, detail] of serviceMap) {if (!detail.systemdUnit && detail.process) {result.set(key, processMatches(entries, detail.process, detail.username, detail.params));}}
    debug(`[service-status] process collection ${Date.now() - startedAt}ms`);
    return result;
}
export function processMatches(procList: { user: string; args: string }[], processName: string, username: string, params?: string[]) {
    const lowerName = processName.toLowerCase();
    return procList.some(({ user, args }) => {
        if (user !== username) {return false;}
        const first = args.match(/^(?:"([^"]+)"|'([^']+)'|(\S+))/);
        const executablePart = (first?.[1] ?? first?.[2] ?? first?.[3] ?? "").split("/").pop() ?? "";
        const executable = executablePart.replace(/^\[|\]$/g, "").toLowerCase();
        if (executable !== lowerName) {return false;}
        return !params || params.every(part => args.toLowerCase().includes(part.toLowerCase()));
    });
}
function coolingDelay(failures: number) { return [5000, 10000, 20000, 30000][Math.min(Math.max(failures - 1, 0), 3)]; }
async function refresh(branch: Branch, cache: BranchCache) {
    if (cache.promise) {return cache.promise;}
    if (cache.refreshTimer) {clearTimeout(cache.refreshTimer); cache.refreshTimer = undefined;}
    const collect = branch === "systemd" ? collectSystemd : collectProcesses;
    const generation = cache.generation;
    const startedAt = Date.now();
    cache.inFlightDeadline = startedAt + responseBudgetMs;
    const task = (async () => {
        try {
            const rawValues = await collect();
            const observedAt = Date.now();
            const values = new Map(cache.value?.values ?? []);
            if (branch === "systemd") {
                for (const [key, info] of serviceMap) {
                    if (!info.systemdUnit) {continue;}
                    const unit = normUnit(info.systemdUnit);
                    const value = rawValues.get(key) ?? rawValues.get(unit);
                    if (value !== undefined) {values.set(key, { value, observedAt });}
                }
            } else {
                for (const [key, value] of rawValues) {values.set(key, { value, observedAt });}
            }
            if (generation === cache.generation) {
                cache.value = { values, stale: false };
                cache.refreshedAt = observedAt;
                const expected = branch === "systemd" ? new Set([...serviceMap.values()].flatMap(info => info.systemdUnit ? [normUnit(info.systemdUnit)] : [])).size : rawValues.size;
                const partial = rawValues.size < expected;
                if (partial) {
                    cache.failures += 1;
                    cache.retryAt = Date.now() + coolingDelay(cache.failures);
                    if (!cache.partialFailed) {console.warn(`[service-status] ${branch} collection incomplete (missing records, ${Date.now() - startedAt}ms)`);}
                    cache.partialFailed = true;
                    cache.failed = false;
                } else {
                    cache.failures = 0;
                    cache.retryAt = 0;
                    if (cache.failed || cache.partialFailed) {console.info(`[service-status] ${branch} collection recovered (${Date.now() - startedAt}ms)`);}
                    cache.failed = false;
                    cache.partialFailed = false;
                }
            }
        } catch (error) {
            if (generation === cache.generation) {
                cache.failures += 1; cache.retryAt = Date.now() + coolingDelay(cache.failures);
                logTransition(branch, cache, error instanceof Error ? ((error as NodeJS.ErrnoException).code ?? error.message) : "unknown", Date.now() - startedAt);
            }
        }
    })();
    cache.promise = task;
    try { await task; } finally {
        if (cache.promise === task) {cache.promise = undefined; cache.inFlightDeadline = 0;}
        if (generation !== cache.generation) {
            void ensure(branch, cache);
            scheduleCooldownRefresh(branch, cache);
        }
    }
}
async function waitForCollection(cache: BranchCache) {
    const current = cache.promise;
    if (!current) {return;}
    const remaining = cache.inFlightDeadline - Date.now();
    if (remaining <= 0) {return;}
    let timer: NodeJS.Timeout | undefined;
    try {
        await Promise.race([current, new Promise<void>(resolve => { timer = setTimeout(resolve, remaining); })]);
    } finally {
        if (timer) {clearTimeout(timer);}
    }
}
async function ensure(branch: Branch, cache: BranchCache) {
    if (cache.promise) {await waitForCollection(cache); return;}
    if (cache.value && Date.now() - cache.refreshedAt < TTL) {return;}
    if (cache.retryAt > Date.now()) {return;}
    void refresh(branch, cache);
    await waitForCollection(cache);
}
function scheduleCooldownRefresh(branch: Branch, cache: BranchCache) {
    if (cache.promise || cache.retryAt <= Date.now() || cache.refreshTimer) {return;}
    cache.refreshTimer = setTimeout(() => {
        cache.refreshTimer = undefined;
        void ensure(branch, cache);
    }, cache.retryAt - Date.now());
}

export async function getServiceSnapshot(): Promise<ServiceSnapshot> {
    await Promise.all([ensure("systemd", systemd), ensure("process", processes)]);
    const out: ServiceSnapshot = {};
    for (const [key, info] of serviceMap) {
        const branch = info.systemdUnit ? systemd : processes;
        const cache = branch.value;
        const entry = cache?.values.get(key);
        const stale = !cache || branch.failed || branch.refreshedAt === 0 || entry === undefined || entry.observedAt < branch.refreshedAt || Boolean(branch.promise && Date.now() >= branch.inFlightDeadline);
        out[key] = { value: entry === undefined ? null : entry.value, observedAt: entry?.observedAt ?? null, stale };
    }
    return out;
}

export async function getServiceHealth() {
    const snapshot = await getServiceSnapshot();
    const states = Object.values(snapshot);
    const unknown = states.some(s => s.value === null);
    const stale = states.some(s => s.stale);
    const health = states.every(s => s.stale || s.value === null) ? "unavailable" : stale || unknown ? "degraded" : "ok";
    const retries = [systemd, processes].filter(c => c.retryAt > Date.now()).map(c => c.retryAt - Date.now());
    return { snapshot, health: health, retryAfterMs: retries.length ? Math.min(...retries) : 0 };
}
export function invalidateServiceState() {
    for (const [branch, cache] of [["systemd", systemd], ["process", processes]] as const) {
        cache.generation += 1;
        cache.refreshedAt = 0;
        if (cache.refreshTimer) {clearTimeout(cache.refreshTimer); cache.refreshTimer = undefined;}
        if (!cache.promise && cache.retryAt > Date.now()) {scheduleCooldownRefresh(branch, cache);}
        else if (!cache.promise) {void ensure(branch, cache);}
    }
}
export async function refreshServiceState(): Promise<ServiceSnapshot> {
    const branches = [["systemd", systemd], ["process", processes]] as const;
    await Promise.all(branches.map(async ([branch, cache]) => {
        cache.generation += 1;
        cache.refreshedAt = 0;
        cache.failures = 0;
        cache.retryAt = 0;
        cache.failed = false;
        cache.partialFailed = false;
        if (cache.refreshTimer) {clearTimeout(cache.refreshTimer); cache.refreshTimer = undefined;}
        const inFlight = cache.promise;
        if (inFlight) {await waitForCollection(cache);}
        if (cache.promise) {return;}
        await refresh(branch, cache);
    }));
    return getServiceSnapshot();
}
export function setServiceStateCollectorsForTests(collectors?: ServiceStateCollectors) {
    collectorOverrides = collectors;
    for (const cache of [systemd, processes]) {
        cache.generation += 1;
        cache.value = undefined;
        cache.refreshedAt = 0;
        cache.failures = 0;
        cache.retryAt = 0;
        cache.failed = false;
        cache.partialFailed = false;
        if (cache.refreshTimer) {clearTimeout(cache.refreshTimer);}
        cache.refreshTimer = undefined;
    }
}
export function setServiceCommandSpawnerForTests(spawner?: typeof spawn) {
    commandSpawner = spawner ?? spawn;
    setServiceStateCollectorsForTests(undefined);
}
