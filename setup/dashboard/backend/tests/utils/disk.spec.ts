// SPDX-License-Identifier: GPL-3.0-or-later
/* eslint-disable @typescript-eslint/no-unused-expressions */

import "mocha";
import { expect } from "chai";

import {
    isTmpFs,
    shouldShowMacOsFileSystem,
    shouldShowFileSystem,
    parseFsSizeOutputSystemInformation,
    FsSizeData,
} from "../../src/utils/disk";

describe("utils/disk", () => {
    describe("isTmpFs", () => {
        it("should identify temporary filesystem types", () => {
            expect(isTmpFs("tmpfs")).to.be.true;
            expect(isTmpFs("devtmpfs")).to.be.true;
            expect(isTmpFs("udev")).to.be.true;
            expect(isTmpFs("overlay")).to.be.true;
            expect(isTmpFs("squashfs")).to.be.true;
            expect(isTmpFs("proc")).to.be.true;
            expect(isTmpFs("sysfs")).to.be.true;
        });

        it("should not identify real filesystem types as tmp", () => {
            expect(isTmpFs("ext4")).to.be.false;
            expect(isTmpFs("xfs")).to.be.false;
            expect(isTmpFs("btrfs")).to.be.false;
            expect(isTmpFs("nfs")).to.be.false;
            expect(isTmpFs("nfs4")).to.be.false;
            expect(isTmpFs("apfs")).to.be.false;
            expect(isTmpFs("vfat")).to.be.false;
        });

        it("should be case-insensitive", () => {
            expect(isTmpFs("TMPFS")).to.be.true;
            expect(isTmpFs("Devtmpfs")).to.be.true;
        });
    });

    describe("shouldShowMacOsFileSystem", () => {
        it("should show /System/Volumes/Data", () => {
            const fs: FsSizeData = {
                fs: "/dev/disk1s1", type: "apfs",
                size: 5e10, used: 1e10, available: 4e10, use: 20,
                mount: "/System/Volumes/Data",
            };
            expect(shouldShowMacOsFileSystem(fs)).to.be.true;
        });

        it("should show /Volumes/* mounts", () => {
            const fs: FsSizeData = {
                fs: "/dev/disk2s1", type: "apfs",
                size: 5e10, used: 1e10, available: 4e10, use: 20,
                mount: "/Volumes/ExternalDrive",
            };
            expect(shouldShowMacOsFileSystem(fs)).to.be.true;
        });

        it("should not show root mount", () => {
            const fs: FsSizeData = {
                fs: "/dev/disk1s1", type: "apfs",
                size: 5e10, used: 1e10, available: 4e10, use: 20,
                mount: "/",
            };
            expect(shouldShowMacOsFileSystem(fs)).to.be.false;
        });

        it("should not show other system volumes", () => {
            const fs: FsSizeData = {
                fs: "/dev/disk1s1", type: "apfs",
                size: 5e10, used: 1e10, available: 4e10, use: 20,
                mount: "/System/Volumes/VM",
            };
            expect(shouldShowMacOsFileSystem(fs)).to.be.false;
        });

        it("should be case-insensitive for mount comparison", () => {
            const fs: FsSizeData = {
                fs: "/dev/disk1s1", type: "apfs",
                size: 5e10, used: 1e10, available: 4e10, use: 20,
                mount: "/system/volumes/data",
            };
            expect(shouldShowMacOsFileSystem(fs)).to.be.true;
        });
    });

    describe("shouldShowFileSystem", () => {
        it("should reject filesystems smaller than 1GB", () => {
            const fs: FsSizeData = {
                fs: "/dev/sda1", type: "ext4",
                size: 500 * 1024 * 1024, used: 100 * 1024 * 1024, available: 400 * 1024 * 1024, use: 20,
                mount: "/boot",
            };
            expect(shouldShowFileSystem(fs, "linux")).to.be.false;
        });

        it("should reject temporary filesystems", () => {
            const fs: FsSizeData = {
                fs: "tmpfs", type: "tmpfs",
                size: 8 * 1024 * 1024 * 1024, used: 0, available: 8 * 1024 * 1024 * 1024, use: 0,
                mount: "/dev/shm",
            };
            expect(shouldShowFileSystem(fs, "linux")).to.be.false;
        });

        it("should reject excluded mount prefixes", () => {
            const fs: FsSizeData = {
                fs: "overlay", type: "ext4",
                size: 50e9, used: 10e9, available: 40e9, use: 20,
                mount: "/var/lib/docker/overlay2/abc",
            };
            expect(shouldShowFileSystem(fs, "linux")).to.be.false;
        });

        it("should accept real Linux filesystems", () => {
            const fs: FsSizeData = {
                fs: "/dev/sda1", type: "ext4",
                size: 500e9, used: 200e9, available: 300e9, use: 40,
                mount: "/",
            };
            expect(shouldShowFileSystem(fs, "linux")).to.be.true;
        });

        it("should use macOS rules on darwin platform", () => {
            const fs: FsSizeData = {
                fs: "/dev/disk1s1", type: "apfs",
                size: 500e9, used: 200e9, available: 300e9, use: 40,
                mount: "/System/Volumes/Data",
            };
            expect(shouldShowFileSystem(fs, "darwin")).to.be.true;
        });

        it("should reject non-Data macOS volumes", () => {
            const fs: FsSizeData = {
                fs: "/dev/disk1s1", type: "apfs",
                size: 500e9, used: 200e9, available: 300e9, use: 40,
                mount: "/System/Volumes/VM",
            };
            expect(shouldShowFileSystem(fs, "darwin")).to.be.false;
        });
    });

    describe("parseFsSizeOutputSystemInformation", () => {
        it("should parse fsSize entries", () => {
            const parsed = parseFsSizeOutputSystemInformation([
                {
                    fs: "C:",
                    type: "NTFS",
                    size: 512000000000,
                    used: 128000000000,
                    use: 25,
                    mount: "C:",
                },
            ] as never);

            expect(parsed).to.have.length(1);
            expect(parsed[0].mount).to.equal("C:");
            expect(parsed[0].available).to.equal(384000000000);
        });

        it("should ignore invalid rows", () => {
            const parsed = parseFsSizeOutputSystemInformation([
                {
                    fs: "",
                    type: "NTFS",
                    size: 0,
                    used: 0,
                    use: 0,
                    mount: "",
                },
            ] as never);

            expect(parsed).to.have.length(0);
        });
    });
});
