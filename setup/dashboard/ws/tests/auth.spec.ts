// SPDX-License-Identifier: GPL-3.0-or-later

import "mocha";
import { expect } from "chai";
import fs from "fs";
import type { IncomingMessage } from "http";
import os from "os";
import path from "path";
import type { NextFunction, Request, Response } from "express";

import {
    authorizeHandshake,
    GATEWAY_HEADER,
    getGatewaySecret,
    hasValidGateway,
    isAllowedOrigin,
    isAuthDisabled,
    readGatewaySecret,
    requestProtocol,
    resetGatewaySecretCache,
    secretsEqual,
    shouldEnforceGateway,
    shouldEnforceOrigin,
    validateProductionAuth,
    gatewayAuthMiddleware,
} from "../src/auth";

function buildRequest(headers: Record<string, string>, remoteAddress = "127.0.0.1"): IncomingMessage {
    return { headers, socket: { remoteAddress } } as unknown as IncomingMessage;
}

describe("auth", () => {
    const envKeys = [
        "QUICKBOX_WS_GATEWAY_SECRET",
        "QUICKBOX_WS_GATEWAY_SECRET_FILE",
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
        resetGatewaySecretCache();
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
        resetGatewaySecretCache();
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

        it("should allow a same-origin request including the matching protocol", () => {
            expect(isAllowedOrigin("https://box.example.test", "box.example.test", "https")).to.equal(true);
            expect(isAllowedOrigin("http://box.example.test", "box.example.test", "http")).to.equal(true);
        });

        it("should normalize default ports on both sides", () => {
            expect(isAllowedOrigin("https://box.example.test:443", "box.example.test", "https")).to.equal(true);
            expect(isAllowedOrigin("https://box.example.test", "box.example.test:443", "https")).to.equal(true);
            expect(isAllowedOrigin("http://box.example.test:80", "box.example.test", "http")).to.equal(true);
        });

        it("should parse https Host authorities with their actual scheme", () => {
            expect(isAllowedOrigin("https://box.example.test:80", "box.example.test:80", "https")).to.equal(true);
            expect(isAllowedOrigin("https://box.example.test", "box.example.test:80", "https")).to.equal(false);
        });

        it("should allow an explicitly configured https origin behind external TLS termination", () => {
            process.env.QUICKBOX_WS_ALLOWED_ORIGINS = "https://external.example.test";
            expect(isAllowedOrigin("https://external.example.test", "internal.example.test", "http")).to.equal(true);
            expect(isAllowedOrigin("http://external.example.test", "internal.example.test", "http")).to.equal(false);
        });

        it("should keep non-default ports significant", () => {
            expect(isAllowedOrigin("https://box.example.test:8443", "box.example.test:8443", "https")).to.equal(true);
            expect(isAllowedOrigin("https://box.example.test:8443", "box.example.test", "https")).to.equal(false);
            expect(isAllowedOrigin("https://box.example.test", "box.example.test:8443", "https")).to.equal(false);
        });

        it("should handle IPv6 authorities with brackets", () => {
            expect(isAllowedOrigin("https://[2001:db8::1]", "[2001:db8::1]", "https")).to.equal(true);
            expect(isAllowedOrigin("https://[2001:db8::1]:8443", "[2001:db8::1]:8443", "https")).to.equal(true);
            expect(isAllowedOrigin("https://[2001:db8::1]", "[2001:db8::1]:8443", "https")).to.equal(false);
            expect(isAllowedOrigin("https://[::1]:8443", "[::1]:8443", "https")).to.equal(true);
        });

        it("should reject cross protocol, cross host and cross port origins", () => {
            expect(isAllowedOrigin("https://box.example.test", "box.example.test", "http")).to.equal(false);
            expect(isAllowedOrigin("http://box.example.test", "box.example.test", "https")).to.equal(false);
            expect(isAllowedOrigin("https://evil.example", "box.example.test", "https")).to.equal(false);
            expect(isAllowedOrigin("https://box.example.test:8443", "box.example.test:9443", "https")).to.equal(false);
        });

        it("should reject unusable origins and missing hosts", () => {
            expect(isAllowedOrigin("not a url", "box.example.test", "https")).to.equal(false);
            expect(isAllowedOrigin("null", "box.example.test", "https")).to.equal(false);
            expect(isAllowedOrigin("file:///etc/passwd", "box.example.test", "https")).to.equal(false);
            expect(isAllowedOrigin("https://box.example.test", undefined, "https")).to.equal(false);
            expect(isAllowedOrigin("https://box.example.test", "", "https")).to.equal(false);
        });

        it("should match configured extra origins exactly", () => {
            process.env.QUICKBOX_WS_ALLOWED_ORIGINS = "https://alt.example.test,https://alt2.example.test:8443";
            expect(isAllowedOrigin("https://alt.example.test", "box.example.test", "https")).to.equal(true);
            expect(isAllowedOrigin("https://alt2.example.test:8443", "box.example.test", "https")).to.equal(true);
            expect(isAllowedOrigin("https://alt.example.test/", "box.example.test", "https")).to.equal(true);
        });

        it("should not widen a full origin entry", () => {
            process.env.QUICKBOX_WS_ALLOWED_ORIGINS = "https://alt.example.test";
            expect(isAllowedOrigin("http://alt.example.test", "box.example.test", "http")).to.equal(false);
            expect(isAllowedOrigin("https://alt.example.test:8443", "box.example.test", "https")).to.equal(false);
        });

        it("should keep host-only entries working for backwards compatibility", () => {
            process.env.QUICKBOX_WS_ALLOWED_ORIGINS = "alt2.example.test";
            expect(isAllowedOrigin("https://alt2.example.test", "box.example.test", "https")).to.equal(true);
            expect(isAllowedOrigin("https://alt2.example.test:8443", "box.example.test", "https")).to.equal(true);
            expect(isAllowedOrigin("https://other.example.test", "box.example.test", "https")).to.equal(false);
        });
    });

    describe("requestProtocol", () => {
        it("should trust X-Forwarded-Proto from the loopback proxy", () => {
            const req = buildRequest({ "x-forwarded-proto": "https" });
            expect(requestProtocol(req)).to.equal("https");
        });

        it("should ignore X-Forwarded-Proto from a non loopback caller", () => {
            const req = buildRequest({ "x-forwarded-proto": "https" }, "203.0.113.5");
            expect(requestProtocol(req)).to.equal("http");
        });

        it("should fall back to the socket encryption state", () => {
            const req = { headers: {}, socket: { remoteAddress: "127.0.0.1", encrypted: true } } as unknown as IncomingMessage;
            expect(requestProtocol(req)).to.equal("https");
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

        it("should honor QUICKBOX_WS_AUTH=0 outside production", () => {
            process.env.NODE_ENV = "test";
            process.env.QUICKBOX_WS_GATEWAY_SECRET = "test-secret";
            process.env.QUICKBOX_WS_AUTH = "0";
            expect(isAuthDisabled()).to.equal(true);
            expect(shouldEnforceGateway()).to.equal(false);
        });

        it("should stay fail-closed in production even with an empty secret", () => {
            process.env.NODE_ENV = "production";
            delete process.env.QUICKBOX_WS_GATEWAY_SECRET;
            process.env.QUICKBOX_WS_GATEWAY_SECRET_FILE = "/nonexistent/quickbox/ws.secret";
            expect(shouldEnforceGateway()).to.equal(true);
            expect(hasValidGateway({ [GATEWAY_HEADER]: "" })).to.equal(false);
            expect(getGatewaySecret()).to.equal("");
        });

        it("should keep the last known secret when the file becomes unreadable", () => {
            const dir = fs.mkdtempSync(path.join(os.tmpdir(), "quickbox-secret-"));
            const secretPath = path.join(dir, "ws.secret");
            fs.writeFileSync(secretPath, "abcdef0123456789abcdef0123456789\n");
            process.env.NODE_ENV = "production";
            process.env.QUICKBOX_WS_GATEWAY_SECRET_FILE = secretPath;
            try {
                expect(readGatewaySecret().secret).to.equal("abcdef0123456789abcdef0123456789");
                fs.unlinkSync(secretPath);
                const state = readGatewaySecret();
                expect(state.secret).to.equal("abcdef0123456789abcdef0123456789");
                expect(state.error).to.be.a("string");
                expect(hasValidGateway({ [GATEWAY_HEADER]: "abcdef0123456789abcdef0123456789" })).to.equal(true);
                expect(hasValidGateway({ [GATEWAY_HEADER]: "" })).to.equal(false);
            } finally {
                fs.rmSync(dir, { recursive: true, force: true });
            }
        });
    });

    describe("validateProductionAuth", () => {
        it("should pass outside production", () => {
            process.env.NODE_ENV = "test";
            delete process.env.QUICKBOX_WS_GATEWAY_SECRET;
            expect(validateProductionAuth()).to.equal(null);
        });

        it("should fail in production without a secret", () => {
            process.env.NODE_ENV = "production";
            delete process.env.QUICKBOX_WS_GATEWAY_SECRET;
            process.env.QUICKBOX_WS_GATEWAY_SECRET_FILE = "/nonexistent/quickbox/ws.secret";
            const problem = validateProductionAuth();
            expect(problem).to.be.a("string");
            expect(problem).to.contain("missing");
        });

        it("should fail in production when authentication is disabled", () => {
            process.env.NODE_ENV = "production";
            process.env.QUICKBOX_WS_GATEWAY_SECRET = "abcdef0123456789abcdef0123456789";
            process.env.QUICKBOX_WS_AUTH = "0";
            expect(validateProductionAuth()).to.contain("QUICKBOX_WS_AUTH=0");
        });

        it("should fail in production when the secret is too short", () => {
            process.env.NODE_ENV = "production";
            process.env.QUICKBOX_WS_GATEWAY_SECRET = "short";
            expect(validateProductionAuth()).to.contain("too short");
        });

        it("should accept a valid production secret", () => {
            process.env.NODE_ENV = "production";
            process.env.QUICKBOX_WS_GATEWAY_SECRET = "abcdef0123456789abcdef0123456789";
            expect(validateProductionAuth()).to.equal(null);
        });
    });

    describe("authorizeHandshake", () => {
        it("should reject a missing gateway header when enforcement is on", () => {
            process.env.QUICKBOX_WS_GATEWAY_SECRET = "test-secret";
            process.env.QUICKBOX_WS_ENFORCE_ORIGIN = "0";
            const req = buildRequest({});
            expect(authorizeHandshake(req)).to.deep.equal({ ok: false, error: "unauthorized" });
        });

        it("should reject a cross-site origin when origin enforcement is on", () => {
            process.env.QUICKBOX_WS_GATEWAY_SECRET = "test-secret";
            process.env.QUICKBOX_WS_ENFORCE_ORIGIN = "1";
            const req = buildRequest({
                [GATEWAY_HEADER]: "test-secret",
                origin: "https://evil.example",
                host: "box.example.test",
            });
            expect(authorizeHandshake(req)).to.deep.equal({ ok: false, error: "origin not allowed" });
        });

        it("should accept a same-origin https handshake behind the TLS proxy", () => {
            process.env.QUICKBOX_WS_GATEWAY_SECRET = "test-secret";
            process.env.QUICKBOX_WS_ENFORCE_ORIGIN = "1";
            const req = buildRequest({
                [GATEWAY_HEADER]: "test-secret",
                "origin": "https://box.example.test",
                "host": "box.example.test",
                "x-forwarded-proto": "https",
            });
            expect(authorizeHandshake(req)).to.deep.equal({ ok: true });
        });

        it("should accept a same-origin handshake on a non-default port", () => {
            process.env.QUICKBOX_WS_GATEWAY_SECRET = "test-secret";
            process.env.QUICKBOX_WS_ENFORCE_ORIGIN = "1";
            const req = buildRequest({
                [GATEWAY_HEADER]: "test-secret",
                "origin": "https://box.example.test:8443",
                "host": "box.example.test:8443",
                "x-forwarded-proto": "https",
            });
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
