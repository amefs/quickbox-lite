// SPDX-License-Identifier: GPL-3.0-or-later
// Unit tests for the runningTask() banner widget.

import "mocha";
import { expect } from "chai";

import { runningTask } from "../../src/widgets/running-task";

describe("widgets/running-task", () => {
    describe("runningTask()", () => {
        it("should render nothing while no operation holds the install lock", async () => {
            expect(await runningTask(() => null)).to.equal("");
        });

        it("should render nothing for a lock without a title", async () => {
            expect(await runningTask(() => "")).to.equal("");
        });

        it("should name the running package and offer the log and abort actions", async () => {
            const html = await runningTask(() => "Jellyfin Media Server");
            expect(html).to.contain("Jellyfin Media Server");
            expect(html).to.contain('data-target="#sysResponse"');
            expect(html).to.contain('data-sysresponse-mode="log-view"');
            expect(html).to.contain('data-target="#taskAbortConfirm"');
            expect(html).to.contain('data-task="package"');
        });

        it("should label an update instead of naming the lock owner", async () => {
            // qbUpdate takes the lock under its own name.
            const html = await runningTask(() => "QuickBox");
            expect(html).to.contain("QuickBox update");
            expect(html).to.contain('data-task="update"');
        });

        it("should announce itself as a status region", async () => {
            const html = await runningTask(() => "Jellyfin Media Server");
            expect(html).to.contain('role="status"');
            expect(html).to.contain("alert-warning");
        });
    });
});
