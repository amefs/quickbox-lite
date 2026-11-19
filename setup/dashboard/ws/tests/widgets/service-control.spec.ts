// SPDX-License-Identifier: GPL-3.0-or-later

import "mocha";
import { expect } from "chai";

import { getServiceControlRows } from "../../src/services/service/control";

describe("widgets/service-control", () => {
    it("should return an array of service rows", () => {
        const result = getServiceControlRows();

        expect(result).to.be.an("array");
    });
});
