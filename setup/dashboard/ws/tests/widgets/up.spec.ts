// SPDX-License-Identifier: GPL-3.0-or-later

import "mocha";
import { expect } from "chai";
import * as sinon from "sinon";
import si from "systeminformation";

import { getUptimeParts } from "../../src/services/system/uptime";

describe("widgets/up", () => {
    let timeStub: sinon.SinonStub;

    beforeEach(() => {
        timeStub = sinon.stub(si, "time");
    });

    afterEach(() => {
        sinon.restore();
    });

    it("should return uptime parts with correct days, hours, minutes", () => {
        timeStub.returns({ uptime: 2 * 86400 + 3 * 3600 + 45 * 60 });

        expect(getUptimeParts()).to.deep.equal({ days: 2, hours: 3, minutes: 45 });
    });

    it("should return zero uptime", () => {
        timeStub.returns({ uptime: 0 });

        expect(getUptimeParts()).to.deep.equal({ days: 0, hours: 0, minutes: 0 });
    });

    it("should correctly wrap hours at 24", () => {
        timeStub.returns({ uptime: 86400 });

        expect(getUptimeParts()).to.deep.equal({ days: 1, hours: 0, minutes: 0 });
    });

    it("should handle large uptime values", () => {
        timeStub.returns({ uptime: 365 * 86400 + 23 * 3600 + 59 * 60 });

        expect(getUptimeParts()).to.deep.equal({ days: 365, hours: 23, minutes: 59 });
    });
});
