// SPDX-License-Identifier: GPL-3.0-or-later

import "mocha";
import { expect } from "chai";
import * as sinon from "sinon";
import os from "os";
import si from "systeminformation";

import { systemLoadData } from "../../src/services/system/load";

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

        it("should return raw load averages and process count", async () => {
            loadavgStub.returns([0.5, 1.2, 2.35]);
            processesStub.resolves({ all: 150 });

            const result = await systemLoadData();
            expect(result).to.deep.equal({ loadavg: [0.5, 1.2, 2.35], processes: 150 });
        });

        it("should handle zero load averages", async () => {
            loadavgStub.returns([0, 0, 0]);
            processesStub.resolves({ all: 0 });

            const result = await systemLoadData();
            expect(result).to.deep.equal({ loadavg: [0, 0, 0], processes: 0 });
        });
    });

    describe("on non-Linux (Windows)", () => {
        beforeEach(() => { platformStub.value(WIN32); });

        it("should return raw currentLoad and process count", async () => {
            processesStub.resolves({ all: 370 });
            currentLoadStub.resolves({ currentLoad: 2.399521838 });

            const result = await systemLoadData();
            expect(result).to.deep.equal({ currentLoad: 2.399521838, processes: 370 });
        });
    });
});
