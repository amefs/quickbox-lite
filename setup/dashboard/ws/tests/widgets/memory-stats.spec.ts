// SPDX-License-Identifier: GPL-3.0-or-later

import "mocha";
import { expect } from "chai";
import * as sinon from "sinon";
import si from "systeminformation";

import { ramStatsData } from "../../src/services/system/memory";

describe("widgets/memory-stats", () => {
    let memStub: sinon.SinonStub;

    beforeEach(() => {
        memStub = sinon.stub(si, "mem");
    });

    afterEach(() => {
        sinon.restore();
    });

    it("should return raw memory byte metrics", async () => {
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

        const result = await ramStatsData();
        expect(result).to.deep.equal({
            total: 16 * 1024 * 1024 * 1024,
            used: 10 * 1024 * 1024 * 1024,
            free: 6 * 1024 * 1024 * 1024,
            cached: 3 * 1024 * 1024 * 1024,
            buffers: 1 * 1024 * 1024 * 1024,
            swapTotal: 4 * 1024 * 1024 * 1024,
            swapUsed: 1 * 1024 * 1024 * 1024,
            swapFree: 3 * 1024 * 1024 * 1024,
        });
    });
});
