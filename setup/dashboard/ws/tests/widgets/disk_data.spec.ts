/* eslint-disable @typescript-eslint/no-unused-expressions */
// SPDX-License-Identifier: GPL-3.0-or-later

import "mocha";
import { expect } from "chai";

import { filterDisplayedFileSystems, parseDfOutputLinux, parseDfOutputMacOS } from "../../src/utils/disk";

describe("widgets/disk_data", () => {
    describe("macOS", () => {
        it("should parse df output with inode columns", () => {
            const stdout = `Filesystem     512-blocks      Used Available Capacity iused     ifree %iused  Mounted on
/dev/disk9s1s1  777777776   8888888  123456789     7%  111111 222222222    0%   /
devfs                 777       777         0   100%     321         0  100%   /dev
/dev/disk9s6    777777776       256  123456789     1%       0 222222222    0%   /System/Volumes/VM
/dev/disk9s2    777777776   4567890  123456789     4%    2048 222222222    0%   /System/Volumes/Preboot
/dev/disk9s4    777777776      8192  123456789     1%      64 222222222    0%   /System/Volumes/Update
/dev/disk8s2      2048000     22222   2025778     2%       4   8888888    0%   /System/Volumes/xarts
/dev/disk8s1      2048000     33333   2014667     2%      16   8888888    0%   /System/Volumes/iSCPreboot
/dev/disk8s3      2048000      4444   2043556     1%      32   8888888    0%   /System/Volumes/Hardware
/dev/disk9s5    777777776 654321000  123456789    84% 1234567 222222222    1%   /System/Volumes/Data
map auto_home           0         0         0   100%       0         0     -   /System/Volumes/Data/home
/dev/disk7s1    333333333 111111111  222222222    34%       1         0  100%   /Volumes/ArchiveDrive`;

            const parsed = parseDfOutputMacOS(stdout);
            const root = parsed.find(item => item.mount === "/");
            const data = parsed.find(item => item.mount === "/System/Volumes/Data");
            const usb = parsed.find(item => item.mount === "/Volumes/ArchiveDrive");

            expect(root).to.exist;
            expect(root?.size).to.equal(777777776 * 512);
            expect(root?.used).to.equal(8888888 * 512);
            expect(root?.available).to.equal(123456789 * 512);
            expect(root?.use).to.equal(7);

            expect(data).to.exist;
            expect(data?.used).to.equal(654321000 * 512);
            expect(data?.use).to.equal(84);

            expect(usb).to.exist;
            expect(usb?.available).to.equal(222222222 * 512);
            expect(usb?.use).to.equal(34);
        });
        it("should keep only macOS data volume and user mounted volumes", () => {
            const stdout = `Filesystem     512-blocks      Used Available Capacity iused     ifree %iused  Mounted on
/dev/disk9s1s1  777777776   8888888  123456789     7%  111111 222222222    0%   /
devfs                 777       777         0   100%     321         0  100%   /dev
/dev/disk9s6    777777776       256  123456789     1%       0 222222222    0%   /System/Volumes/VM
/dev/disk9s5    777777776 654321000  123456789    84% 1234567 222222222    1%   /System/Volumes/Data
map auto_home           0         0         0   100%       0         0     -   /System/Volumes/Data/home
/dev/disk7s1    333333333 111111111  222222222    34%       1         0  100%   /Volumes/ArchiveDrive`;

            const filtered = filterDisplayedFileSystems(parseDfOutputMacOS(stdout), "darwin");

            expect(filtered.map(item => item.mount)).to.deep.equal([
                "/System/Volumes/Data",
                "/Volumes/ArchiveDrive",
            ]);
        });
    });

    describe("Linux", () => {
        it("should parse df output with root and EFI partitions", () => {
            const stdout = `Filesystem     Type     1024-blocks     Used Available Capacity Mounted on
tmpfs          tmpfs        2100000     2048   2097952       1% /run
efivarfs       efivarfs         512       64       448      13% /sys/firmware/efi/efivars
/dev/vdb2      ext4        222222222 55555555 166666667      25% /
tmpfs          tmpfs        4200000        0   4200000       0% /dev/shm
tmpfs          tmpfs           8192        0      8192       0% /run/lock
/dev/vdb1      vfat          256000     4096    251904       2% /boot/efi
tmpfs          tmpfs        2100000       16   2099984       1% /run/user/2000`;

            const parsed = parseDfOutputLinux(stdout);
            const root = parsed.find(item => item.mount === "/");
            const efi = parsed.find(item => item.mount === "/boot/efi");
            const run = parsed.find(item => item.mount === "/run");

            expect(parsed).to.have.length(7);

            expect(root).to.exist;
            expect(root?.fs).to.equal("/dev/vdb2");
            expect(root?.type).to.equal("ext4");
            expect(root?.size).to.equal(222222222 * 1024);
            expect(root?.used).to.equal(55555555 * 1024);
            expect(root?.available).to.equal(166666667 * 1024);
            expect(root?.use).to.equal(25);

            expect(efi).to.exist;
            expect(efi?.type).to.equal("vfat");
            expect(efi?.use).to.equal(1.6);

            expect(run).to.exist;
            expect(run?.type).to.equal("tmpfs");
        });

        it("should parse df output with multiple real disks", () => {
            const stdout = `Filesystem     Type     1024-blocks      Used Available Capacity Mounted on
udev           devtmpfs      1500000         0    1500000       0% /dev
tmpfs          tmpfs          300000      9000     291000       3% /run
/dev/mmcblk1p7 ext4         8000000   4800000   3200000      60% /
tmpfs          tmpfs         900000         0     900000       0% /dev/shm
tmpfs          tmpfs           4096         0       4096       0% /run/lock
tmpfs          tmpfs         900000        12     899988       1% /tmp
/dev/mmcblk1p6 ext4          600000    180000     420000      30% /boot
/dev/sdc1      ext4       555555555 222222222 333333333      40% /mnt/archive
tmpfs          tmpfs          300000         0     300000       0% /run/user/3000`;

            const parsed = parseDfOutputLinux(stdout);
            const root = parsed.find(item => item.mount === "/");
            const archive = parsed.find(item => item.mount === "/mnt/archive");
            const boot = parsed.find(item => item.mount === "/boot");

            expect(parsed).to.have.length(9);

            expect(root).to.exist;
            expect(root?.fs).to.equal("/dev/mmcblk1p7");
            expect(root?.size).to.equal(8000000 * 1024);
            expect(root?.use).to.equal(60);

            expect(archive).to.exist;
            expect(archive?.fs).to.equal("/dev/sdc1");
            expect(archive?.available).to.equal(333333333 * 1024);
            expect(archive?.use).to.equal(40);

            expect(boot).to.exist;
            expect(boot?.used).to.equal(180000 * 1024);
        });

        it("should remove temporary Linux filesystems but keep real disks", () => {
            const stdout = `Filesystem          Type      1024-blocks     Used Available Capacity Mounted on
udev                devtmpfs  4000000         0        4000000   0%    /dev
tmpfs               tmpfs     2000000      1234        1998766   1%    /run
/dev/vda2           ext4      1500000000  600000000    900000000  40%   /
tmpfs               tmpfs     8000000         0        8000000   0%    /dev/shm
tmpfs               tmpfs     1024            0        1024      0%    /run/credentials/systemd-journald.service
tmpfs               tmpfs     4096            0        4096      0%    /run/lock
tmpfs               tmpfs     8000000         0        8000000   0%    /tmp
/dev/vda1           ext4      900000        100000      800000    12%   /boot
tmpfs               tmpfs     1024            0        1024      0%    /run/credentials/getty@tty1.service
tmpfs               tmpfs     2000000        12        1999988   1%    /run/user/1000
backup-sample.local:/srv/export/demo nfs4   500000000      1000     499999000  1%    /srv/archive`;

            const filtered = filterDisplayedFileSystems(parseDfOutputLinux(stdout), "linux");

            expect(filtered.map(item => item.mount)).to.deep.equal([
                "/",
                "/srv/archive",
            ]);
        });
    });
});
