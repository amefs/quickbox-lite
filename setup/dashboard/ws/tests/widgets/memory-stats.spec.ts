// SPDX-License-Identifier: GPL-3.0-or-later

import "mocha";
import { expect } from "chai";
import * as sinon from "sinon";
import si from "systeminformation";

import { ramStats } from "../../src/widgets/memory-stats";

describe("widgets/memory-stats", () => {
    let memStub: sinon.SinonStub;

    beforeEach(() => {
        memStub = sinon.stub(si, "mem");
    });

    afterEach(() => {
        sinon.restore();
    });

    it("should render physical memory section", async () => {
        memStub.resolves({
            total: 8 * 1024 * 1024 * 1024,     // 8 GB
            used: 4 * 1024 * 1024 * 1024,      // 4 GB
            free: 4 * 1024 * 1024 * 1024,      // 4 GB
            cached: 0,
            buffers: 0,
            swaptotal: 0,
            swapused: 0,
            swapfree: 0,
        });

        const result = await ramStats();
        expect(result).to.be.a("string");
        expect(result).to.include("progress-bar");
        expect(result).to.include("50");  // 50% usage
    });

    it("should render cached memory section when cached > 0", async () => {
        memStub.resolves({
            total: 16 * 1024 * 1024 * 1024,
            used: 8 * 1024 * 1024 * 1024,
            free: 8 * 1024 * 1024 * 1024,
            cached: 2 * 1024 * 1024 * 1024,
            buffers: 512 * 1024 * 1024,
            swaptotal: 0,
            swapused: 0,
            swapfree: 0,
        });

        const result = await ramStats();
        expect(result).to.include("progress-bar");
        // Should have physical + cached + real sections
        expect(result).to.include("col-sm-12");
    });

    it("should render swap section when swaptotal > 0", async () => {
        memStub.resolves({
            total: 8 * 1024 * 1024 * 1024,
            used: 4 * 1024 * 1024 * 1024,
            free: 4 * 1024 * 1024 * 1024,
            cached: 0,
            buffers: 0,
            swaptotal: 2 * 1024 * 1024 * 1024,
            swapused: 1 * 1024 * 1024 * 1024,
            swapfree: 1 * 1024 * 1024 * 1024,
        });

        const result = await ramStats();
        expect(result).to.include("progress-bar");
    });

    it("should use danger color for high memory usage (>=90%)", async () => {
        memStub.resolves({
            total: 1000,
            used: 950,
            free: 50,
            cached: 0,
            buffers: 0,
            swaptotal: 0,
            swapused: 0,
            swapfree: 0,
        });

        const result = await ramStats();
        expect(result).to.include("progress-bar-danger");
    });

    it("should use warning color for moderate memory usage (>=70%)", async () => {
        memStub.resolves({
            total: 1000,
            used: 750,
            free: 250,
            cached: 0,
            buffers: 0,
            swaptotal: 0,
            swapused: 0,
            swapfree: 0,
        });

        const result = await ramStats();
        expect(result).to.include("progress-bar-warning");
    });

    it("should use success color for low memory usage (<70%)", async () => {
        memStub.resolves({
            total: 1000,
            used: 300,
            free: 700,
            cached: 0,
            buffers: 0,
            swaptotal: 0,
            swapused: 0,
            swapfree: 0,
        });

        const result = await ramStats();
        expect(result).to.include("progress-bar-success");
    });

    it("should render TOTAL_RAM section", async () => {
        memStub.resolves({
            total: 8 * 1024 * 1024 * 1024,
            used: 1 * 1024 * 1024 * 1024,
            free: 7 * 1024 * 1024 * 1024,
            cached: 0,
            buffers: 0,
            swaptotal: 0,
            swapused: 0,
            swapfree: 0,
        });

        const result = await ramStats();
        expect(result).to.include("8.00 GB");
    });

    it("should render all sections when cached and swap both exist", async () => {
        memStub.resolves({
            total: 16 * 1024 * 1024 * 1024,
            used: 10 * 1024 * 1024 * 1024,
            free: 6 * 1024 * 1024 * 1024,
            cached: 3 * 1024 * 1024 * 1024,
            buffers: 1 * 1024 * 1024 * 1024,
            swaptotal: 4 * 1024 * 1024 * 1024,
            swapused: 1 * 1024 * 1024 * 1024,
            swapfree: 3 * 1024 * 1024 * 1024,
        });

        const result = await ramStats();
        expect(result).to.be.a("string");
        // Should contain multiple progress bars
        const progressBarCount = (result.match(/progress-bar-/g) || []).length;
        expect(progressBarCount).to.be.greaterThan(2);
    });
});
