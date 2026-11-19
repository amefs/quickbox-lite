// SPDX-License-Identifier: GPL-3.0-or-later

import "mocha";
import { expect } from "chai";
import { EventEmitter } from "events";
import type { Socket } from "socket.io";
import request from "supertest";

import { app } from "../../src/server";
import type { DashboardBootstrapPayload } from "../../src/shared/bootstrap-contract";
import Constant from "../../src/shared/constants";
import {
    createPushManager,
    getActiveSamplerCount,
    notifyPushSubscribers,
    pushHandler,
    type PushSpec,
} from "../../src/socket/push";

class FakeSocket extends EventEmitter {
    public connected = true;
    public sent: unknown[] = [];

    public send(payload: unknown) {
        this.sent.push(payload);
        return this;
    }
}

describe("socket/push", () => {
    it("should expose wsPushMode in bootstrap and respect QUICKBOX_WS_PUSH_MODE", async () => {
        const prev = process.env.QUICKBOX_WS_PUSH_MODE;
        try {
            delete process.env.QUICKBOX_WS_PUSH_MODE;
            const defaultRes = await request(app).get("/node/bootstrap");
            expect(defaultRes.status).to.equal(200);
            expect((defaultRes.body as DashboardBootstrapPayload).wsPushMode).to.equal("push");

            process.env.QUICKBOX_WS_PUSH_MODE = "poll";
            const pollRes = await request(app).get("/node/bootstrap");
            expect(pollRes.status).to.equal(200);
            expect((pollRes.body as DashboardBootstrapPayload).wsPushMode).to.equal("poll");
        } finally {
            if (prev === undefined) {
                delete process.env.QUICKBOX_WS_PUSH_MODE;
            } else {
                process.env.QUICKBOX_WS_PUSH_MODE = prev;
            }
        }
    });

    it("should push updates in push mode and stop when switched to poll mode", async () => {
        const fake = new FakeSocket();
        pushHandler(fake as unknown as Socket);

        fake.emit(Constant.EVENT_WS_SUBSCRIBE, { mode: "push", locale: "en", bandwidthPage: "t" });
        await new Promise((resolve) => setTimeout(resolve, 650));

        expect(fake.sent.length).to.be.greaterThan(0);
        const hasPushV1 = fake.sent.some((msg) => {
            const record = msg as { push?: boolean; key?: string; success?: boolean };
            return record.push === true && record.success === true && typeof record.key === "string";
        });
        const hasPushServiceStatus = fake.sent.some((msg) => {
            const record = msg as { push?: boolean; key?: string; success?: boolean };
            return record.push === true && record.success === true && record.key === "SERVICE_STATUS_ALL";
        });
        const hasV2Meta = fake.sent.some((msg) => {
            const record = msg as { meta?: { protocolVersion?: number } };
            return record.meta?.protocolVersion === 2;
        });
        expect(hasPushV1).to.equal(true);
        expect(hasPushServiceStatus).to.equal(true);
        expect(hasV2Meta).to.equal(false);

        const beforeNotify = fake.sent.length;
        notifyPushSubscribers(["TASK_STATUS"]);
        await new Promise((resolve) => setTimeout(resolve, 50));
        expect(fake.sent.length).to.be.greaterThan(beforeNotify);

        fake.emit(Constant.EVENT_WS_SUBSCRIBE, { mode: "poll" });
        const afterPollCount = fake.sent.length;
        notifyPushSubscribers(["TASK_STATUS"]);
        await new Promise((resolve) => setTimeout(resolve, 50));
        expect(fake.sent.length).to.equal(afterPollCount);

        fake.connected = false;
        fake.emit(Constant.EVENT_DISCONNECT);
        expect(getActiveSamplerCount()).to.equal(0);
    });

    it("should share samplers for identical params and split samplers when params differ", async () => {
        const fakeA = new FakeSocket();
        const fakeB = new FakeSocket();
        pushHandler(fakeA as unknown as Socket);
        pushHandler(fakeB as unknown as Socket);

        fakeA.emit(Constant.EVENT_WS_SUBSCRIBE, { mode: "push", locale: "en", bandwidthPage: "t" });
        const singleCount = getActiveSamplerCount();
        expect(singleCount).to.equal(10);

        // Same params -> reuses all 10 samplers (no duplicate collection)
        fakeB.emit(Constant.EVENT_WS_SUBSCRIBE, { mode: "push", locale: "zh", bandwidthPage: "t" });
        expect(getActiveSamplerCount()).to.equal(singleCount);

        // Different BANDWIDTH page -> only 1 extra BANDWIDTH:h sampler
        fakeB.emit(Constant.EVENT_WS_SUBSCRIBE, { mode: "push", locale: "zh", bandwidthPage: "h" });
        expect(getActiveSamplerCount()).to.equal(singleCount + 1);

        await new Promise((resolve) => setTimeout(resolve, 150));
        expect(fakeA.sent.length).to.be.greaterThan(0);
        expect(fakeB.sent.length).to.be.greaterThan(0);

        fakeA.connected = false;
        fakeA.emit(Constant.EVENT_DISCONNECT);
        expect(getActiveSamplerCount()).to.equal(singleCount);

        fakeB.connected = false;
        fakeB.emit(Constant.EVENT_DISCONNECT);
        expect(getActiveSamplerCount()).to.equal(0);
    });

    it("should only refresh BANDWIDTH when bandwidthPage changes", async () => {
        let otherFetches = 0;
        let bandwidthFetches = 0;
        const specs: PushSpec[] = [
            {
                key: "UPTIME",
                url: "/node/data/system_uptime",
                visibleMs: 60000,
                hiddenMs: 180000,
                dedupe: true,
                fetch: () => {
                    otherFetches += 1;
                    return Promise.resolve({ days: otherFetches });
                },
            },
            {
                key: "BANDWIDTH",
                url: "/node/data/bandwidth",
                visibleMs: 60000,
                hiddenMs: 180000,
                paramKey: (state) => state.bandwidthPage,
                fetch: (page) => {
                    bandwidthFetches += 1;
                    return Promise.resolve({ page, count: bandwidthFetches });
                },
            },
        ];
        const manager = createPushManager(specs);
        const fake = new FakeSocket();
        manager.pushHandler(fake as unknown as Socket);

        fake.emit(Constant.EVENT_WS_SUBSCRIBE, { mode: "push", bandwidthPage: "t" });
        await new Promise((resolve) => setTimeout(resolve, 100));
        expect(otherFetches).to.equal(1);
        expect(bandwidthFetches).to.equal(1);

        fake.sent.length = 0;
        fake.emit(Constant.EVENT_WS_SUBSCRIBE, { mode: "push", bandwidthPage: "h" });
        await new Promise((resolve) => setTimeout(resolve, 100));

        const keys = fake.sent.map((msg) => (msg as { key?: string }).key);
        expect(keys).to.deep.equal(["BANDWIDTH"]);
        expect(otherFetches).to.equal(1);
        expect(bandwidthFetches).to.equal(2);

        fake.connected = false;
        fake.emit(Constant.EVENT_DISCONNECT);
        expect(manager.getActiveSamplerCount()).to.equal(0);
    });

    it("should tighten sampler schedule when a hidden sampler gets a visible subscriber", async () => {
        let count = 0;
        const specs: PushSpec[] = [
            {
                key: "NETWORK",
                url: "/node/net_status",
                visibleMs: 60,
                hiddenMs: 10000,
                fetch: () => {
                    count += 1;
                    return Promise.resolve({ seq: count });
                },
            },
        ];
        const manager = createPushManager(specs);
        const hiddenClient = new FakeSocket();
        const visibleClient = new FakeSocket();
        manager.pushHandler(hiddenClient as unknown as Socket);
        manager.pushHandler(visibleClient as unknown as Socket);

        hiddenClient.emit(Constant.EVENT_WS_SUBSCRIBE, { mode: "push", hidden: true });
        await new Promise((resolve) => setTimeout(resolve, 30));
        expect(count).to.equal(1);

        // Visible client joins while cached data is fresh (< visibleMs); timer must tighten from 10000ms to ~60ms
        visibleClient.emit(Constant.EVENT_WS_SUBSCRIBE, { mode: "push", hidden: false });
        await new Promise((resolve) => setTimeout(resolve, 130));
        expect(count).to.be.greaterThan(1);
        expect(visibleClient.sent.length).to.be.greaterThan(1);

        hiddenClient.connected = false;
        hiddenClient.emit(Constant.EVENT_DISCONNECT);
        visibleClient.connected = false;
        visibleClient.emit(Constant.EVENT_DISCONNECT);
        expect(manager.getActiveSamplerCount()).to.equal(0);
    });

    it("should queue a forced follow-up run when notifyPushSubscribers is called while inFlight", async () => {
        let fetchCount = 0;
        let releaseFirst: (() => void) | undefined;
        const specs: PushSpec[] = [
            {
                key: "SERVICE_STATUS_ALL",
                url: "/node/v2/service_status_all",
                visibleMs: 60000,
                hiddenMs: 120000,
                dedupe: true,
                fetch: () => {
                    fetchCount += 1;
                    const seq = fetchCount;
                    if (seq === 1) {
                        return new Promise((resolve) => {
                            releaseFirst = () => {
                                resolve({ seq });
                            };
                        });
                    }
                    return Promise.resolve({ seq });
                },
            },
        ];
        const manager = createPushManager(specs);
        const fake = new FakeSocket();
        manager.pushHandler(fake as unknown as Socket);

        fake.emit(Constant.EVENT_WS_SUBSCRIBE, { mode: "push" });
        await new Promise((resolve) => setTimeout(resolve, 25));
        expect(fetchCount).to.equal(1);

        // Trigger notify while first fetch is still in flight
        manager.notifyPushSubscribers(["SERVICE_STATUS_ALL"]);
        releaseFirst?.();
        await new Promise((resolve) => setTimeout(resolve, 40));

        expect(fetchCount).to.equal(2);
        const seqs = fake.sent.map((msg) => (msg as { response?: { seq?: number } }).response?.seq);
        expect(seqs).to.deep.equal([1, 2]);

        fake.connected = false;
        fake.emit(Constant.EVENT_DISCONNECT);
        expect(manager.getActiveSamplerCount()).to.equal(0);
    });

    it("should push failure payloads and clear dedupe digest so recovery is delivered", async () => {
        let shouldFail = false;
        const specs: PushSpec[] = [
            {
                key: "SERVICE_STATUS_ALL",
                url: "/node/v2/service_status_all",
                visibleMs: 60000,
                hiddenMs: 120000,
                dedupe: true,
                fetch: () => {
                    if (shouldFail) {
                        return Promise.reject(new Error("boom"));
                    }
                    return Promise.resolve({ health: "ok", states: { rtorrent: { value: true, stale: false } } });
                },
            },
        ];
        const manager = createPushManager(specs);
        const fake = new FakeSocket();
        manager.pushHandler(fake as unknown as Socket);

        fake.emit(Constant.EVENT_WS_SUBSCRIBE, { mode: "push" });
        await new Promise((resolve) => setTimeout(resolve, 30));
        expect(fake.sent.length).to.equal(1);
        expect((fake.sent[0] as { success?: boolean }).success).to.equal(true);

        shouldFail = true;
        manager.notifyPushSubscribers(["SERVICE_STATUS_ALL"]);
        await new Promise((resolve) => setTimeout(resolve, 30));
        expect(fake.sent.length).to.equal(2);
        expect(fake.sent[1]).to.include({
            push: true,
            success: false,
            key: "SERVICE_STATUS_ALL",
        });

        // Recover with identical data: must be pushed because error cleared lastDigest
        shouldFail = false;
        manager.notifyPushSubscribers(["SERVICE_STATUS_ALL"]);
        await new Promise((resolve) => setTimeout(resolve, 30));
        expect(fake.sent.length).to.equal(3);
        expect((fake.sent[2] as { success?: boolean }).success).to.equal(true);

        fake.connected = false;
        fake.emit(Constant.EVENT_DISCONNECT);
        expect(manager.getActiveSamplerCount()).to.equal(0);
    });
});
