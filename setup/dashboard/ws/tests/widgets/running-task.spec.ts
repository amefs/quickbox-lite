// SPDX-License-Identifier: GPL-3.0-or-later
// Unit tests for the runningTask() banner widget.

import "mocha";
import { expect } from "chai";

import { detectRunningTaskOperation, runningTaskData } from "../../src/services/packages/running-task";

describe("widgets/running-task", () => {
    describe("runningTaskData()", () => {
        it("should return inactive state while no operation holds the install lock", () => {
            expect(runningTaskData(() => null)).to.deep.equal({
                active: false,
                kind: "package",
                operation: "",
            });
        });

        it("should return inactive state for a lock without a title", () => {
            expect(runningTaskData(() => "")).to.deep.equal({
                active: false,
                kind: "package",
                operation: "",
            });
        });

        it("should return structured task metadata without rendered text or labels", () => {
            expect(runningTaskData(() => "Jellyfin Media Server", () => "install")).to.deep.equal({
                active: true,
                kind: "install",
                operation: "install",
                title: "Jellyfin Media Server",
            });
            expect(runningTaskData(() => "Jellyfin Media Server", () => "remove")).to.deep.equal({
                active: true,
                kind: "remove",
                operation: "remove",
                title: "Jellyfin Media Server",
            });
            expect(runningTaskData(() => "Jellyfin Media Server", () => "update")).to.deep.equal({
                active: true,
                kind: "update",
                operation: "update",
                title: "Jellyfin Media Server",
            });
        });

        it("should fall back to package kind when the verb is unknown", () => {
            expect(runningTaskData(() => "Jellyfin Media Server", () => null)).to.deep.equal({
                active: true,
                kind: "package",
                operation: "",
                title: "Jellyfin Media Server",
            });
        });

        it("should label QuickBox updates with kind=update", () => {
            expect(runningTaskData(() => "QuickBox", () => "update")).to.deep.equal({
                active: true,
                kind: "update",
                operation: "update",
                title: "QuickBox",
            });
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
