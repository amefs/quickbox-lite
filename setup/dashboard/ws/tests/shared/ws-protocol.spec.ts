// SPDX-License-Identifier: GPL-3.0-or-later

import "mocha";
import { expect } from "chai";

import {
    isWsExecResult,
    isWsMessageEnvelope,
    isWsWidgetRequest,
    parseLegacySshOutputRequest,
    parseWsMessageEnvelope,
    parseWsSubscribeOptions,
} from "../../src/shared/ws-message";
import { isServiceActionResult } from "../../src/shared/service-control-contract";

describe("shared/ws-protocol", () => {
    describe("isWsWidgetRequest", () => {
        const valid = {
            type: "request",
            key: "UPTIME",
            url: "/node/data/system_uptime",
            requestId: "UPTIME:1",
        };

        it("accepts valid widget requests with optional args", () => {
            expect(isWsWidgetRequest(valid)).to.equal(true);
            expect(isWsWidgetRequest({ ...valid, args: { page: "h", offset: 0, length: 1024, epoch: "e1" } })).to.equal(true);
        });

        it("rejects requests with invalid type, empty requestId, or non-integer offsets", () => {
            expect(isWsWidgetRequest({ ...valid, type: "reply" })).to.equal(false);
            expect(isWsWidgetRequest({ ...valid, requestId: "" })).to.equal(false);
            expect(isWsWidgetRequest({ ...valid, args: { offset: "0" } })).to.equal(false);
        });
    });

    describe("isWsMessageEnvelope", () => {
        it("accepts protocol-error, reply, and push envelopes", () => {
            expect(isWsMessageEnvelope({ type: "protocol-error", message: "Invalid payload" })).to.equal(true);
            expect(isWsMessageEnvelope({
                type: "reply",
                key: "UPTIME",
                url: "/node/data/system_uptime",
                requestId: "UPTIME:1",
                success: true,
                message: "",
                response: {},
            })).to.equal(true);
            expect(isWsMessageEnvelope({
                type: "push",
                key: "BANDWIDTH",
                url: "/node/data/bandwidth",
                args: { page: "t" },
                success: false,
                message: "Widget render failed",
                response: "",
                stale: true,
            })).to.equal(true);
        });

        it("rejects envelopes with mismatched type fields or invalid stale flag", () => {
            expect(isWsMessageEnvelope({ type: "request", key: "UPTIME", url: "/x", requestId: "1", message: "" })).to.equal(false);
            expect(isWsMessageEnvelope({
                type: "reply",
                key: "UPTIME",
                url: "/x",
                requestId: "",
                success: true,
                message: "",
                response: {},
            })).to.equal(false);
            expect(isWsMessageEnvelope({
                type: "push",
                key: "UPTIME",
                url: "/x",
                success: true,
                message: "",
                response: {},
                stale: false,
            })).to.equal(false);
        });
    });

    describe("parseWsSubscribeOptions", () => {
        it("normalizes known fields and ignores invalid values", () => {
            expect(parseWsSubscribeOptions(null)).to.deep.equal({});
            expect(parseWsSubscribeOptions({ mode: "poll", bandwidthPage: "d", hidden: true })).to.deep.equal({
                mode: "poll",
                bandwidthPage: "d",
                hidden: true,
            });
            expect(parseWsSubscribeOptions({ mode: "other", bandwidthPage: "invalid", hidden: "yes" })).to.deep.equal({
                bandwidthPage: "t",
            });
        });
    });

    describe("isWsExecResult", () => {
        it("validates exec result payloads", () => {
            expect(isWsExecResult({
                cmd: "box:update:",
                success: true,
                message: "",
                stdout: "ok",
                stderr: "",
            })).to.equal(true);
            expect(isWsExecResult({ cmd: "box:update:", success: "yes", message: "", stdout: "", stderr: "" })).to.equal(false);
        });
    });

    describe("isServiceActionResult", () => {
        const base = {
            requestId: "SERVICE_ACTION:1",
            service: "rtorrent",
            action: "restart",
            success: true,
            message: "Service action completed",
            completedOperations: ["restart"],
            stdout: "",
            stderr: "",
        };

        it("validates each phase of the discriminated union", () => {
            expect(isServiceActionResult({ ...base, phase: "rejected", success: false, completedOperations: [] })).to.equal(true);
            expect(isServiceActionResult({ ...base, phase: "rejected", success: true, completedOperations: [] })).to.equal(false);
            expect(isServiceActionResult({ ...base, phase: "action-complete" })).to.equal(true);
            expect(isServiceActionResult({
                ...base,
                phase: "status-confirmed",
                enabled: true,
                statusData: {
                    states: { rtorrent: { value: true, observedAt: 1000, stale: false } },
                    health: "ok",
                    retryAfterMs: 0,
                },
            })).to.equal(true);
            expect(isServiceActionResult({ ...base, phase: "unknown" })).to.equal(false);
        });
    });

    describe("legacy SSH_OUTPUT bridge", () => {
        it("parses legacy SSH_OUTPUT requests with query parameters and rejects non-log routes", () => {
            expect(parseLegacySshOutputRequest({
                key: "SSH_OUTPUT",
                url: "/db/output.log?offset=128&length=65536&epoch=e1",
                requestId: "SSH_OUTPUT:1",
            })).to.deep.equal({
                key: "SSH_OUTPUT",
                url: "/db/output.log?offset=128&length=65536&epoch=e1",
                requestId: "SSH_OUTPUT:1",
                args: { offset: 128, length: 65536, epoch: "e1" },
            });
            expect(parseLegacySshOutputRequest({
                key: "SSH_OUTPUT",
                url: "/db/output.log?length=1024",
            })).to.deep.equal({
                key: "SSH_OUTPUT",
                url: "/db/output.log?length=1024",
                args: { length: 1024 },
            });
            expect(parseLegacySshOutputRequest({
                key: "SSH_OUTPUT",
                url: "/etc/passwd",
            })).to.equal(null);
            expect(parseLegacySshOutputRequest({
                key: "UPTIME",
                url: "/db/output.log",
            })).to.equal(null);
        });

        it("normalizes legacy SSH_OUTPUT replies without a type field", () => {
            expect(parseWsMessageEnvelope({
                key: "SSH_OUTPUT",
                requestId: "SSH_OUTPUT:2",
                url: "/db/output.log?length=65536",
                pathName: "/db/output.log",
                success: true,
                message: "",
                response: { content: "ok", start: 0, end: 2, size: 2, epoch: "e1" },
            })).to.deep.equal({
                type: "reply",
                key: "SSH_OUTPUT",
                requestId: "SSH_OUTPUT:2",
                url: "/db/output.log?length=65536",
                success: true,
                message: "",
                response: { content: "ok", start: 0, end: 2, size: 2, epoch: "e1" },
            });
            expect(parseWsMessageEnvelope({
                key: "UPTIME",
                requestId: "UPTIME:1",
                url: "/node/data/system_uptime",
                success: true,
                message: "",
                response: {},
            })).to.equal(null);
        });
    });
});
