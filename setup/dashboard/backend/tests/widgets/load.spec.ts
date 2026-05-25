// SPDX-License-Identifier: GPL-3.0-or-later

import "mocha";
import { expect } from "chai";
import * as sinon from "sinon";
import os from "os";
import si from "systeminformation";

import { widgetsLoad } from "../../src/widgets/load";

const POSIX = "linux";
const WIN32 = "win32";

describe("widgets/load", () => {
    let loadavgStub: sinon.SinonStub;
    let processesStub: sinon.SinonStub;
    let currentLoadStub: sinon.SinonStub;
    let platformStub: sinon.SinonStub;

    beforeEach(() => {
        loadavgStub = sinon.stub(os, "loadavg");
        processesStub = sinon.stub(si, "processes");
        currentLoadStub = sinon.stub(si, "currentLoad");
        platformStub = sinon.stub(process, "platform");
    });

    afterEach(() => {
        sinon.restore();
    });

    describe("on Linux / macOS", () => {
        beforeEach(() => { platformStub.value(POSIX); });

        it("should return formatted load averages and process count", async () => {
            loadavgStub.returns([0.5, 1.2, 2.35]);
            processesStub.resolves({ all: 150 });

            const result = await widgetsLoad();
            expect(result).to.equal("0.50 1.20 2.35 150");
        });

        it("should handle zero load averages", async () => {
            loadavgStub.returns([0, 0, 0]);
            processesStub.resolves({ all: 0 });

            const result = await widgetsLoad();
            expect(result).to.equal("0.00 0.00 0.00 0");
        });

        it("should handle high load averages", async () => {
            loadavgStub.returns([99.99, 88.88, 77.77]);
            processesStub.resolves({ all: 999 });

            const result = await widgetsLoad();
            expect(result).to.equal("99.99 88.88 77.77 999");
        });

        it("should format load to 2 decimal places", async () => {
            loadavgStub.returns([1.123456, 2.987654, 3.1]);
            processesStub.resolves({ all: 42 });

            const result = await widgetsLoad();
            expect(result).to.equal("1.12 2.99 3.10 42");
        });
    });

    describe("on non-Linux (Windows / macOS)", () => {
        beforeEach(() => { platformStub.value(WIN32); });

        it("should return currentLoad percentage and process count", async () => {
            processesStub.resolves({ all: 370 });
            currentLoadStub.resolves({ currentLoad: 2.399521838 });

            const result = await widgetsLoad();
            expect(result).to.equal("2.40% 370");
        });

        it("should handle 0% CPU load", async () => {
            processesStub.resolves({ all: 10 });
            currentLoadStub.resolves({ currentLoad: 0 });

            const result = await widgetsLoad();
            expect(result).to.equal("0.00% 10");
        });
    });
});
