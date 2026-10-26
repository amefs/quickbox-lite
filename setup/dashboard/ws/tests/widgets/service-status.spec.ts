// SPDX-License-Identifier: GPL-3.0-or-later

import "mocha";
import { expect } from "chai";
import { EventEmitter } from "events";
import { spawn as nativeSpawn, type spawn } from "child_process";
import { renderServiceBadge, serviceStatusAll } from "../../src/widgets/service-status";
import { withLocale } from "../../src/i18n";
import { getServiceHealth, getServiceSnapshot, invalidateServiceState, parseSystemdShow, processMatches, setServiceCommandSpawnerForTests, setServiceStateCollectorsForTests } from "../../src/widgets/service-state";
import { serviceMap } from "../../src/info";

describe("widgets/service-status", () => {
    function allBranchValues(value: boolean, systemdOnly = false) {
        const values = new Map<string, boolean>();
        for (const [key, detail] of serviceMap) {
            if (Boolean(detail.systemdUnit) === systemdOnly) {values.set(key, value);}
        }
        return values;
    }

    afterEach(() => { setServiceCommandSpawnerForTests(undefined); });

    it("renders known, unknown and stale states distinctly", () => {
        expect(renderServiceBadge(true)).to.include("badge-service-running-pulse");
        expect(renderServiceBadge(false)).to.include("badge-service-disabled-dot");
        const unknown = renderServiceBadge({ value: null, observedAt: null, stale: true });
        expect(unknown).to.include("badge-service-unknown-dot");
        expect(unknown).to.include("Status not confirmed");
        const stale = renderServiceBadge({ value: true, observedAt: 1, stale: true });
        expect(stale).to.include("badge-service-running-dot");
        expect(stale).to.include("badge-service-stale");
        expect(stale).to.include("Last confirmed");
    });

    it("renders localized last-confirmed titles concurrently without leaking locale or placeholders", async () => {
        const state = { value: true, observedAt: 1234, stale: true };
        const [english, chinese] = await Promise.all([
            withLocale("en", () => renderServiceBadge(state)),
            withLocale("zh", () => renderServiceBadge(state)),
        ]);
        expect(english).to.include("Last confirmed 1970-01-01T00:00:01.234Z");
        expect(chinese).to.include("最后确认时间：1970-01-01T00:00:01.234Z");
        expect(english).to.not.include("{{time}}");
        expect(chinese).to.not.include("{{time}}");
        expect(english).to.not.include("最后确认时间");
        expect(chinese).to.not.include("Last confirmed");
    });

    it("returns the health envelope with keyed HTML badges", async () => {
        const result = await serviceStatusAll();
        expect(result).to.have.keys("badges", "health", "retryAfterMs");
        expect(result.badges).to.have.property("irssi");
        expect(result.badges.irssi).to.include("badge-service-");
        expect(["ok", "degraded", "unavailable"]).to.include(result.health);
        expect(result.retryAfterMs).to.be.a("number");
    });

    it("keeps partial systemd records when a missing unit makes the command fail", () => {
        const values = parseSystemdShow(
            "Id=alpha.service\nNames=alpha.service\nLoadState=loaded\nActiveState=active\n\nId=gone.service\nNames=gone.service\nLoadState=not-found\nActiveState=inactive\n",
            ["alpha.service", "gone.service", "missing@user.name.service"], 1,
        );
        expect(values.get("alpha.service")).to.equal(true);
        expect(values.get("gone.service")).to.equal(false);
        expect(values.has("missing@user.name.service")).to.equal(false);
        const alias = parseSystemdShow(
            "Id=canonical.service\nNames=canonical.service alias.service\nLoadState=loaded\nActiveState=active\n",
            ["alias.service"], 0,
        );
        expect(alias.get("alias.service")).to.equal(true);
        const incomplete = parseSystemdShow(
            "Id=no-load.service\nNames=no-load.service\nActiveState=active\n\nId=unknown-state.service\nNames=unknown-state.service\nLoadState=loaded\nActiveState=unknown\n",
            ["no-load.service", "unknown-state.service"], 0,
        );
        expect(incomplete.size).to.equal(0);
    });

    it("matches full argv0 names, users and params without matching incidental arguments", () => {
        const rows = [
            { user: "long-user.name", args: "/usr/bin/transmission-daemon --foreground" },
            { user: "long-user.name", args: "/usr/bin/python /opt/flexget.py run" },
            { user: "long-user.name", args: "/usr/bin/editor transmission-daemon" },
            { user: "root", args: "[nfsd]" },
        ];
        expect(processMatches(rows, "transmission-daemon", "long-user.name")).to.equal(true);
        expect(processMatches(rows, "python", "long-user.name", ["flexget.py"])).to.equal(true);
        expect(processMatches(rows, "transmission-daemon", "someone-else")).to.equal(false);
        expect(processMatches(rows, "transmission-daemon", "long-user.name", ["--rpc"])).to.equal(false);
        expect(processMatches(rows, "nfsd", "root")).to.equal(true);
    });

    it("shares concurrent HTTP style single and batch reads and caches raw values", async () => {
        let systemdCalls = 0;
        let processCalls = 0;
        setServiceStateCollectorsForTests({
            systemd: () => { systemdCalls += 1; return Promise.resolve(allBranchValues(true, true)); },
            process: () => { processCalls += 1; return Promise.resolve(allBranchValues(false)); },
        });
        const [batch, state] = await Promise.all([serviceStatusAll(), getServiceSnapshot()]);
        expect(batch.badges.denyhosts).to.include("badge-service-running");
        expect(state.irssi).to.deep.equal({ value: false, observedAt: state.irssi.observedAt, stale: false });
        await getServiceSnapshot();
        expect(systemdCalls).to.equal(1);
        expect(processCalls).to.equal(1);
    });

    it("keeps per service history during branch failure and respects cooldown", async () => {
        let fail = false;
        let systemdCalls = 0;
        setServiceStateCollectorsForTests({
            systemd: () => { systemdCalls += 1; return fail ? Promise.reject(new Error("fixture-error")) : Promise.resolve(allBranchValues(true, true)); },
            process: () => Promise.resolve(allBranchValues(true)),
        });
        const before = await getServiceSnapshot();
        expect(before.denyhosts.value).to.equal(true);
        fail = true;
        invalidateServiceState();
        const stale = await getServiceSnapshot();
        expect(stale.denyhosts).to.include({ value: true, stale: true });
        await getServiceSnapshot();
        expect(systemdCalls).to.equal(2);
    });

    it("treats an empty successful ps command as a failed sample instead of stopped services", async () => {
        const fakeSpawn = ((_command: string, _args: string[], options: Parameters<typeof nativeSpawn>[2]) => {
            const actual = nativeSpawn(process.execPath, ["-e", "process.exit(0)"], options);
            const child = Object.assign(new EventEmitter(), { stdout: actual.stdout, kill: (signal: NodeJS.Signals) => actual.kill(signal) });
            actual.on("error", error => child.emit("error", error));
            actual.on("close", (code, signal) => child.emit("close", code, signal));
            return child;
        }) as unknown as typeof spawn;
        setServiceCommandSpawnerForTests(fakeSpawn);
        const result = await getServiceSnapshot();
        expect(result.irssi).to.include({ value: null, stale: true });
    });

    it("returns at the response budget but keeps a hanging collector shared until it settles", async function() {
        this.timeout(4000);
        let systemdCalls = 0;
        let releaseSystemd: ((values: Map<string, boolean>) => void) | undefined;
        setServiceStateCollectorsForTests({
            systemd: () => {
                systemdCalls += 1;
                return new Promise(resolve => { releaseSystemd = resolve; });
            },
            process: () => Promise.resolve(allBranchValues(true)),
        });
        const startedAt = Date.now();
        const first = await getServiceSnapshot();
        expect(Date.now() - startedAt).to.be.lessThan(3000);
        expect(first.denyhosts).to.include({ value: null, stale: true });
        expect(first.irssi).to.include({ value: true, stale: false });
        expect((await getServiceHealth()).health).to.equal("degraded");
        const second = await getServiceSnapshot();
        expect(second.denyhosts).to.include({ value: null, stale: true });
        expect(systemdCalls).to.equal(1);
        releaseSystemd?.(allBranchValues(true, true));
        await new Promise(resolve => setTimeout(resolve, 0));
        const recovered = await getServiceSnapshot();
        expect(recovered.denyhosts).to.include({ value: true, stale: false });
        expect(systemdCalls).to.equal(1);
    });

    it("kills a timed out subprocess and keeps it in flight until close", async function() {
        this.timeout(5000);
        const calls: string[] = [];
        const signals: string[] = [];
        const fakeSpawn = ((command: string, args: string[], options: Parameters<typeof nativeSpawn>[2]) => {
            calls.push(command);
            const script = command === "ps"
                ? "process.stdout.write('root /usr/bin/unrelated-process\\n'); process.exit(0)"
                : "process.on('SIGTERM', () => {}); setInterval(() => {}, 1000)";
            const actual = nativeSpawn(process.execPath, ["-e", script], options);
            const child = Object.assign(new EventEmitter(), {
                stdout: actual.stdout,
                kill: (signal: NodeJS.Signals) => { signals.push(signal); return actual.kill(signal); },
            });
            actual.on("error", error => child.emit("error", error));
            actual.on("close", (code, signal) => setTimeout(() => child.emit("close", code, signal), command === "ps" ? 0 : 1000));
            return child;
        }) as unknown as typeof spawn;
        setServiceCommandSpawnerForTests(fakeSpawn);
        const startedAt = Date.now();
        const first = await getServiceSnapshot();
        expect(Date.now() - startedAt).to.be.lessThan(3000);
        expect(first.denyhosts).to.include({ value: null, stale: true });
        await getServiceSnapshot();
        expect(calls.filter(command => command === "systemctl")).to.have.length(1);
        await new Promise(resolve => setTimeout(resolve, 1000));
        expect(signals).to.include("SIGTERM");
        expect(signals).to.include("SIGKILL");
    });

    it("caps output and escalates a child that ignores SIGTERM", async function() {
        this.timeout(5000);
        const signals: NodeJS.Signals[] = [];
        const fakeSpawn = ((command: string, _args: string[], options: Parameters<typeof nativeSpawn>[2]) => {
            const script = command === "ps"
                ? "process.stdout.write('root /usr/bin/unrelated-process\\n'); process.exit(0)"
                : "process.on('SIGTERM', () => {}); setInterval(() => process.stdout.write('x'.repeat(65536)), 1)";
            const actual = nativeSpawn(process.execPath, ["-e", script], options);
            const child = Object.assign(new EventEmitter(), {
                stdout: actual.stdout,
                kill: (signal: NodeJS.Signals) => { signals.push(signal); return actual.kill(signal); },
            });
            actual.on("error", error => child.emit("error", error));
            actual.on("close", (code, signal) => child.emit("close", code, signal));
            return child;
        }) as unknown as typeof spawn;
        setServiceCommandSpawnerForTests(fakeSpawn);
        const startedAt = Date.now();
        await getServiceSnapshot();
        expect(Date.now() - startedAt).to.be.lessThan(2500);
        expect(signals).to.include("SIGTERM");
        expect(signals).to.include("SIGKILL");
    });
});
