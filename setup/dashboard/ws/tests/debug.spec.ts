// SPDX-License-Identifier: GPL-3.0-or-later

import "mocha";
import { expect } from "chai";

import { getDebugEndpoints, getDebugMeta, getDebugPackages } from "../src/debug-meta";

describe("debug metadata", () => {
    it("should include widget endpoint definitions", () => {
        const endpoints = getDebugEndpoints();
        const urls = endpoints.map((ep) => ep.url);
        expect(urls).to.include("/node/load");
        expect(urls).to.include("/node/net_status");
        expect(urls).to.include("/node/up");
        expect(urls).to.include("/node/disk_data");
        expect(urls).to.include("/node/ram_stats");
        expect(urls).to.include("/node/bw_tables?page=h");
        expect(urls).to.include("/db/output.log");
    });

    it("should include service status endpoints", () => {
        const serviceEndpoints = getDebugEndpoints().filter((ep) => ep.category === "service");
        expect(serviceEndpoints.length).to.be.greaterThan(0);
        expect(serviceEndpoints.every((ep) => ep.url.startsWith("/node/service_status?service="))).to.equal(true);
    });

    it("should build debug meta payload with theme and basePath", () => {
        const meta = getDebugMeta("smoked", "/ws");
        expect(meta.theme).to.equal("smoked");
        expect(meta.basePath).to.equal("/ws");
        expect(meta.endpoints).to.have.lengthOf(getDebugEndpoints().length);
        expect(meta.packages).to.deep.equal(getDebugPackages());
    });
});
