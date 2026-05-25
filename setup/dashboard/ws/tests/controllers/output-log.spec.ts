// SPDX-License-Identifier: GPL-3.0-or-later

import "mocha";
import { expect } from "chai";
import request from "supertest";

import { app } from "../../src/server";

interface OutputLogResponse {
    content: string;
    start: number;
    end: number;
    size: number;
}

describe("controllers/output-log", () => {
    it("should return incremental output log JSON over HTTP", async () => {
        const res = await request(app).get("/db/output.log?length=10");
        const body = res.body as OutputLogResponse;

        expect(res.status).to.equal(200);
        expect(body).to.have.keys(["content", "start", "end", "size"]);
        expect(body.content).to.be.a("string");
        expect(body.start).to.be.a("number");
        expect(body.end).to.be.a("number");
        expect(body.size).to.be.a("number");
    });
});
