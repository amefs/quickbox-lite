// SPDX-License-Identifier: GPL-3.0-or-later
// Unit tests for the runningTask() banner widget.

import "mocha";
import { expect } from "chai";

import { detectRunningTaskOperation, runningTask } from "../../src/widgets/running-task";

describe("widgets/running-task", () => {
    describe("runningTask()", () => {
        it("should render nothing while no operation holds the install lock", async () => {
            expect(await runningTask(() => null)).to.equal("");
        });

        it("should render nothing for a lock without a title", async () => {
            expect(await runningTask(() => "")).to.equal("");
        });

        it("should name the running package and offer the log and abort actions", async () => {
            const html = await runningTask(() => "Jellyfin Media Server", () => "install");
            expect(html).to.contain("Jellyfin Media Server");
            expect(html).to.contain('data-target="#sysResponse"');
            expect(html).to.contain('data-sysresponse-mode="log-view"');
            expect(html).to.contain('data-target="#taskAbortConfirm"');
            expect(html).to.contain('data-task="install"');
            expect(html).to.contain('data-operation="install"');
        });

        it("should say what the operation does to the package", async () => {
            expect(await runningTask(() => "Jellyfin Media Server", () => "install"))
                .to.contain("Installing Jellyfin Media Server");
            expect(await runningTask(() => "Jellyfin Media Server", () => "remove"))
                .to.contain("Removing Jellyfin Media Server");
            expect(await runningTask(() => "Jellyfin Media Server", () => "update"))
                .to.contain("Updating Jellyfin Media Server");
        });

        it("should fall back to a generic sentence when the verb is unknown", async () => {
            const html = await runningTask(() => "Jellyfin Media Server", () => null);
            expect(html).to.contain("Jellyfin Media Server is running");
            expect(html).to.contain('data-task="package"');
            expect(html).to.contain('data-operation=""');
        });

        it("should label an update instead of naming the lock owner", async () => {
            // qbUpdate takes the lock under its own name.
            const html = await runningTask(() => "QuickBox", () => "update");
            expect(html).to.contain("QuickBox update");
            expect(html).to.contain('data-task="update"');
        });

        it("should announce itself as a status region", async () => {
            const html = await runningTask(() => "Jellyfin Media Server", () => "install");
            expect(html).to.contain('role="status"');
            expect(html).to.contain("alert-warning");
        });
    });

    describe("detectRunningTaskOperation()", () => {
        const cmdline = (...argv: string[]) => `${argv.join("\0")}\0`;

        it("should read the verb from the lifecycle script that owns the lock", () => {
            const detect = (script: string, pids = ["1", "100"]) => detectRunningTaskOperation(
                () => pids,
                (pid) => (pid === "100" ? cmdline("/bin/bash", script) : cmdline("/sbin/init")),
            );

            expect(detect("/usr/local/bin/quickbox/package/install/installpackage-jellyfin")).to.equal("install");
            expect(detect("/usr/local/bin/quickbox/package/remove/removepackage-jellyfin")).to.equal("remove");
            expect(detect("/usr/local/bin/quickbox/package/update/updatepackage-jellyfin")).to.equal("update");
            expect(detect("/usr/local/bin/quickbox/system/qbUpdate", ["1", "100"])).to.equal("update");
            expect(detect("/usr/local/bin/quickbox/system/auxiliary/install-BBR.sh")).to.equal("install");
        });

        it("should not mistake box itself for the operation it launched", () => {
            const operation = detectRunningTaskOperation(
                () => ["100"],
                () => cmdline("/bin/bash", "/usr/local/bin/quickbox/system/box", "install", "jellyfin"),
            );
            expect(operation).to.equal(null);
        });

        it("should ignore processes that only mention a lifecycle script", () => {
            const script = "/usr/local/bin/quickbox/package/install/installpackage-jellyfin";
            const commands = [
                cmdline("/usr/bin/vim", script),
                cmdline("/bin/cat", script),
                cmdline("/bin/grep", "APP_TITLE", script),
                cmdline("/bin/bash", "-c", `cat ${script}`),
                cmdline("/bin/bash", "-c", script),
                cmdline("/bin/bash", "/tmp/inspect.sh", script),
            ];
            for (const command of commands) {
                expect(detectRunningTaskOperation(() => ["100"], () => command), command).to.equal(null);
            }
        });

        it("should identify the real updater while an editor opens a removal script", () => {
            const commands: Record<string, string> = {
                100: cmdline("/usr/bin/vim", "/usr/local/bin/quickbox/package/remove/removepackage-jellyfin"),
                200: cmdline("/bin/bash", "/usr/local/bin/quickbox/package/update/updatepackage-jellyfin"),
            };
            for (const pids of [["100", "200"], ["200", "100"]]) {
                expect(detectRunningTaskOperation(() => pids, pid => commands[pid])).to.equal("update");
            }
        });

        it("should fall back when running scripts have conflicting operations", () => {
            const commands: Record<string, string> = {
                100: cmdline("/bin/bash", "/usr/local/bin/quickbox/package/remove/removepackage-jellyfin"),
                200: cmdline("/bin/bash", "/usr/local/bin/quickbox/package/update/updatepackage-jellyfin"),
            };
            for (const pids of [["100", "200"], ["200", "100"]]) {
                expect(detectRunningTaskOperation(() => pids, pid => commands[pid])).to.equal(null);
            }
        });

        it("should accept repeated candidates for the same operation", () => {
            expect(detectRunningTaskOperation(
                () => ["100", "200"],
                () => cmdline("/bin/bash", "/usr/local/bin/quickbox/package/update/updatepackage-jellyfin"),
            )).to.equal("update");
        });

        it("should require the exact installed script path and lifecycle name", () => {
            const scripts = [
                "/tmp/usr/local/bin/quickbox/package/install/installpackage-jellyfin",
                "/usr/local/bin/quickbox/package/install/inspect.sh",
                "/usr/local/bin/quickbox/package/install/removepackage-jellyfin",
                "/usr/local/bin/quickbox/package/install/installpackage-jellyfin/child",
                "/usr/local/bin/quickbox/system/qbUpdate.backup",
                "/usr/local/bin/quickbox/system/auxiliary/install-BBR.sh.backup",
            ];
            for (const script of scripts) {
                expect(detectRunningTaskOperation(
                    () => ["100"],
                    () => cmdline("/bin/bash", script),
                ), script).to.equal(null);
            }
        });

        it("should accept the Bash executable names used by Linux launches", () => {
            for (const shell of ["bash", "/bin/bash", "/usr/bin/bash"]) {
                expect(detectRunningTaskOperation(
                    () => ["100"],
                    () => cmdline(shell, "/usr/local/bin/quickbox/package/install/installpackage-jellyfin", "--log", "/tmp/log"),
                ), shell).to.equal("install");
            }
        });

        it("should return null when /proc is unavailable", () => {
            expect(detectRunningTaskOperation(() => {
                throw new Error("ENOENT: no such file or directory, scandir '/proc'");
            })).to.equal(null);
        });

        it("should skip entries that are not pids and processes that exited mid-scan", () => {
            const operation = detectRunningTaskOperation(
                () => ["self", "cpuinfo", "200"],
                () => {
                    throw new Error("ENOENT: no such process");
                },
            );
            expect(operation).to.equal(null);
        });
    });
});
