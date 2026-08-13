// SPDX-License-Identifier: GPL-3.0-or-later

import "mocha";
import { expect } from "chai";
import type { IncomingMessage } from "http";
import type { NextFunction, Request, Response } from "express";

import {
    authorizeHandshake,
    GATEWAY_HEADER,
    getGatewaySecret,
    hasValidGateway,
    isAllowedOrigin,
    secretsEqual,
    shouldEnforceGateway,
    shouldEnforceOrigin,
    gatewayAuthMiddleware,
} from "../src/auth";

describe("auth", () => {
    const envKeys = [
        "QUICKBOX_WS_GATEWAY_SECRET",
        "QUICKBOX_WS_AUTH",
        "QUICKBOX_WS_ENFORCE_ORIGIN",
        "QUICKBOX_WS_ALLOWED_ORIGINS",
        "NODE_ENV",
    ] as const;
    const savedEnv: Partial<Record<typeof envKeys[number], string | undefined>> = {};

    beforeEach(() => {
        for (const key of envKeys) {
            savedEnv[key] = process.env[key];
        }
    });

    afterEach(() => {
        for (const key of envKeys) {
            const value = savedEnv[key];
            if (value === undefined) {
                Reflect.deleteProperty(process.env, key);
            } else {
                process.env[key] = value;
            }
        }
    });

    describe("secretsEqual", () => {
        it("should accept matching secrets", () => {
            expect(secretsEqual("abc", "abc")).to.equal(true);
        });

        it("should reject mismatched or empty secrets", () => {
            expect(secretsEqual("abc", "abd")).to.equal(false);
            expect(secretsEqual("", "")).to.equal(false);
            expect(secretsEqual("ab", "abc")).to.equal(false);
        });
    });

    describe("isAllowedOrigin", () => {
        it("should allow missing origin (non-browser clients)", () => {
            expect(isAllowedOrigin(undefined, "example.test")).to.equal(true);
            expect(isAllowedOrigin("", "example.test")).to.equal(true);
        });

        it("should allow origin host matching the request host", () => {
            expect(isAllowedOrigin("https://box.example.test", "box.example.test")).to.equal(true);
            expect(isAllowedOrigin("https://box.example.test:443", "box.example.test:443")).to.equal(true);
        });

        it("should reject a cross-site origin", () => {
            expect(isAllowedOrigin("https://evil.example", "box.example.test")).to.equal(false);
            expect(isAllowedOrigin("not a url", "box.example.test")).to.equal(false);
        });

        it("should allow configured extra origins", () => {
            process.env.QUICKBOX_WS_ALLOWED_ORIGINS = "https://alt.example.test, alt2.example.test";
            expect(isAllowedOrigin("https://alt.example.test", "box.example.test")).to.equal(true);
            expect(isAllowedOrigin("https://alt2.example.test", "box.example.test")).to.equal(true);
        });
    });

    describe("gateway enforcement", () => {
        it("should skip enforcement in test mode without a secret", () => {
            process.env.NODE_ENV = "test";
            delete process.env.QUICKBOX_WS_GATEWAY_SECRET;
            expect(shouldEnforceGateway()).to.equal(false);
        });

        it("should enforce when a secret is configured", () => {
            process.env.NODE_ENV = "test";
            process.env.QUICKBOX_WS_GATEWAY_SECRET = "test-secret";
            expect(shouldEnforceGateway()).to.equal(true);
            expect(getGatewaySecret()).to.equal("test-secret");
            expect(hasValidGateway({ [GATEWAY_HEADER]: "test-secret" })).to.equal(true);
            expect(hasValidGateway({ [GATEWAY_HEADER]: "wrong" })).to.equal(false);
        });

        it("should honor QUICKBOX_WS_AUTH=0", () => {
            process.env.QUICKBOX_WS_GATEWAY_SECRET = "test-secret";
            process.env.QUICKBOX_WS_AUTH = "0";
            expect(shouldEnforceGateway()).to.equal(false);
        });
    });

    describe("authorizeHandshake", () => {
        it("should reject a missing gateway header when enforcement is on", () => {
            process.env.QUICKBOX_WS_GATEWAY_SECRET = "test-secret";
            process.env.QUICKBOX_WS_ENFORCE_ORIGIN = "0";
            const req = { headers: {} } as IncomingMessage;
            expect(authorizeHandshake(req)).to.deep.equal({ ok: false, error: "unauthorized" });
        });

        it("should reject a cross-site origin when origin enforcement is on", () => {
            process.env.QUICKBOX_WS_GATEWAY_SECRET = "test-secret";
            process.env.QUICKBOX_WS_ENFORCE_ORIGIN = "1";
            const req = {
                headers: {
                    [GATEWAY_HEADER]: "test-secret",
                    origin: "https://evil.example",
                    host: "box.example.test",
                },
            } as unknown as IncomingMessage;
            expect(authorizeHandshake(req)).to.deep.equal({ ok: false, error: "origin not allowed" });
        });

        it("should accept a same-origin handshake with a valid gateway secret", () => {
            process.env.QUICKBOX_WS_GATEWAY_SECRET = "test-secret";
            process.env.QUICKBOX_WS_ENFORCE_ORIGIN = "1";
            const req = {
                headers: {
                    [GATEWAY_HEADER]: "test-secret",
                    origin: "https://box.example.test",
                    host: "box.example.test",
                },
            } as unknown as IncomingMessage;
            expect(authorizeHandshake(req)).to.deep.equal({ ok: true });
        });
    });

    describe("gatewayAuthMiddleware", () => {
        it("should return 401 when the gateway header is wrong", () => {
            process.env.QUICKBOX_WS_GATEWAY_SECRET = "test-secret";
            const req = { headers: { [GATEWAY_HEADER]: "nope" } } as unknown as Request;
            const res = {
                statusCode: 0,
                body: "",
                status(code: number) {
                    this.statusCode = code;
                    return this;
                },
                send(body: string) {
                    this.body = body;
                },
            };
            let nextCalled = false;
            gatewayAuthMiddleware(req, res as unknown as Response, (() => {
                nextCalled = true;
            }) as NextFunction);
            expect(nextCalled).to.equal(false);
            expect(res.statusCode).to.equal(401);
        });

        it("should call next when the gateway header matches", () => {
            process.env.QUICKBOX_WS_GATEWAY_SECRET = "test-secret";
            const req = { headers: { [GATEWAY_HEADER]: "test-secret" } } as unknown as Request;
            const res = {} as Response;
            let nextCalled = false;
            gatewayAuthMiddleware(req, res, (() => {
                nextCalled = true;
            }) as NextFunction);
            expect(nextCalled).to.equal(true);
        });
    });

    describe("shouldEnforceOrigin", () => {
        it("should be off in test unless explicitly enabled", () => {
            process.env.NODE_ENV = "test";
            delete process.env.QUICKBOX_WS_ENFORCE_ORIGIN;
            expect(shouldEnforceOrigin()).to.equal(false);
            process.env.QUICKBOX_WS_ENFORCE_ORIGIN = "1";
            expect(shouldEnforceOrigin()).to.equal(true);
        });
    });
});
