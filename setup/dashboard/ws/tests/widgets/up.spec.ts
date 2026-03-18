// SPDX-License-Identifier: GPL-3.0-or-later

import "mocha";
import { expect } from "chai";
import * as sinon from "sinon";
import si from "systeminformation";

import { upTime } from "../../src/widgets/up";

describe("widgets/up", () => {
    let timeStub: sinon.SinonStub;

    beforeEach(() => {
        timeStub = sinon.stub(si, "time");
    });

    afterEach(() => {
        sinon.restore();
    });

    it("should render uptime with correct days, hours, minutes", () => {
        // 2 days, 3 hours, 45 minutes = 2*86400 + 3*3600 + 45*60
        timeStub.returns({ uptime: 2 * 86400 + 3 * 3600 + 45 * 60 });

        const result = upTime();
        expect(result).to.include("<b>2</b>");
        expect(result).to.include("<b>3</b>");
        expect(result).to.include("<b>45</b>");
        expect(result).to.include("<span");
    });

    it("should render zero uptime", () => {
        timeStub.returns({ uptime: 0 });

        const result = upTime();
        expect(result).to.include("<b>0</b>");
    });

    it("should correctly wrap hours at 24", () => {
        // exactly 1 day = 86400
        timeStub.returns({ uptime: 86400 });

        const result = upTime();
        expect(result).to.include("<b>1</b>"); // 1 day
        // hours should be 0
        expect(result).to.match(/<b>0<\/b>/);
    });

    it("should handle large uptime values", () => {
        // 365 days, 23 hours, 59 minutes
        timeStub.returns({ uptime: 365 * 86400 + 23 * 3600 + 59 * 60 });

        const result = upTime();
        expect(result).to.include("<b>365</b>");
        expect(result).to.include("<b>23</b>");
        expect(result).to.include("<b>59</b>");
    });

    it("should return valid HTML string", () => {
        timeStub.returns({ uptime: 3661 });

        const result = upTime();
        expect(result).to.include("font-size");
        expect(result).to.include("<span");
        expect(result).to.include("<b>");
        expect(result).to.include("<small>");
    });
});
