// SPDX-License-Identifier: GPL-3.0-or-later

import "mocha";
import { expect } from "chai";

import { escapeHtml, serializeJsonForScript } from "../../src/utils/html";

describe("utils/html", () => {
    describe("serializeJsonForScript", () => {
        it("should escape sequences that would close a script tag", () => {
            const encoded = serializeJsonForScript({ value: "</script><script>alert(1)" });
            expect(encoded).to.not.include("</script>");
            expect(encoded).to.include("\\u003c/script\\u003e");
            expect(JSON.parse(encoded)).to.deep.equal({ value: "</script><script>alert(1)" });
        });
    });

    describe("escapeHtml", () => {
        it("should escape HTML metacharacters", () => {
            expect(escapeHtml("<img src=\"x\" onerror='alert(1)'>")).to.equal(
                "&lt;img src=&quot;x&quot; onerror=&#39;alert(1)&#39;&gt;",
            );
        });
    });
});
