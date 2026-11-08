// SPDX-License-Identifier: GPL-3.0-or-later

import "mocha";
import { expect } from "chai";

import { mockVnstatInterface } from "../../src/testing/mock-vnstat";

describe("mock vnstat dump paths", () => {
    it("recognizes the path produced by path.join", () => {
        expect(mockVnstatInterface("dumps/vnstat_dump_eth0")).to.equal("eth0");
    });

    it("recognizes a path that keeps a leading ./", () => {
        expect(mockVnstatInterface("./dumps/vnstat_dump_eth0")).to.equal("eth0");
    });

    it("recognizes Windows separators", () => {
        expect(mockVnstatInterface("dumps\\vnstat_dump_eth0")).to.equal("eth0");
    });

    it("ignores paths outside the vnstat dumps directory", () => {
        expect(mockVnstatInterface("/srv/dashboard/db/interface.txt")).to.equal(undefined);
        expect(mockVnstatInterface("dumps/other_file")).to.equal(undefined);
    });
});
