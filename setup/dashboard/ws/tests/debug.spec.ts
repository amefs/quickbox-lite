// SPDX-License-Identifier: GPL-3.0-or-later

import "mocha";
import { expect } from "chai";

import { getDebugEndpoints, getDebugMeta, getDebugPackages } from "../src/services/config/debug-meta";

describe("debug metadata", () => {
    it("should include widget endpoint definitions", () => {
        const endpoints = getDebugEndpoints();
        const urls = endpoints.map((ep) => ep.url);
        expect(urls).to.include("/node/data/system_load");
        expect(urls).to.include("/node/data/system_static");
        expect(urls).to.include("/node/net_status");
        expect(urls).to.include("/node/data/system_uptime");
        expect(urls).to.include("/node/data/disk_data");
        expect(urls).to.include("/node/data/ram_stats");
        expect(urls).to.include("/node/data/bandwidth?page=h");
        expect(urls).to.include("/node/data/task_status");
        expect(urls).to.include("/node/data/pmc");
        expect(urls).to.include("/db/output.log");
    });

    it("should include service status endpoints", () => {
        const serviceEndpoints = getDebugEndpoints().filter((ep) => ep.category === "service");
        expect(serviceEndpoints.length).to.be.greaterThan(0);
        expect(serviceEndpoints.some((ep) => ep.url === "/node/v2/service_control")).to.equal(true);
        expect(serviceEndpoints.some((ep) => ep.url === "/node/v2/service_status_all")).to.equal(true);
    });

    it("should build debug meta payload with theme and basePath", () => {
        const meta = getDebugMeta("smoked", "/ws");
        expect(meta.theme).to.equal("smoked");
        expect(meta.basePath).to.equal("/ws");
        expect(meta.endpoints).to.have.lengthOf(getDebugEndpoints().length);
        expect(meta.packages).to.deep.equal(getDebugPackages());
    });
});
