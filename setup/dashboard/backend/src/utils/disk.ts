import { exec } from "child_process";
import { promisify } from "util";
import si from "systeminformation";

export interface FsSizeData {
    fs: string;
    type: string;
    size: number;
    used: number;
    available: number;
    use: number;
    mount: string;
}

const IS_DARWIN = process.platform === "darwin";
const IS_LINUX = process.platform === "linux";
const IS_WIN32 = process.platform === "win32";
const execAsync = promisify(exec);
const MINIMUM_DISK_SIZE = 1 << 30; // 1GB

const TMP_FILESYSTEMS = [
    // Linux temporary/virtual filesystems
    "rootfs",
    "unionfs",
    "squashfs",
    "cramfs",
    "initrd",
    "initramfs",
    "devtmpfs",
    "tmpfs",
    "udev",
    "devfs",
    "specfs",
    "appimaged",
    // Container/virtual filesystems (Linux)
    "overlay",
    "aufs",
    "proc",
    "sysfs",
    "cgroup",
    "nsfs",
    // macOS virtual filesystems
    "devfs",
    "autofs",
];

const EXCLUDED_MOUNT_PREFIXES = [
    // Linux specific
    "/var/lib/docker/",
    "/snap/",
    "/run/",
    "/dev",
    "/sys/",
    "/proc",
    "/var/lib/kubelet/",
    "/run/containerd/",
    "/var/lib/containers/",
];

function getMacOsFsType(fsName: string): string {
    // NFS mounts don't start with /
    if (!fsName.startsWith("/")) {
        return "nfs";
    }
    // For macOS, we default to "apfs" for modern systems, "hfs" otherwise
    // A more precise method would parse diskutil output, but this is sufficient
    return "apfs";
}

export function parseDfOutputLinux(stdout: string): FsSizeData[] {
    const lines = stdout.split("\n");
    const dataLines = lines.filter(line => {
        const trimmed = line.trim();
        return trimmed !== "" && !trimmed.toLowerCase().startsWith("filesystem");
    });

    const result: FsSizeData[] = [];

    for (const rawLine of dataLines) {
        const parts = rawLine.replace(/ +/g, " ").trim().split(" ");
        // Format: Filesystem Type 1024-blocks Used Available Capacity Mounted-on
        if (parts.length < 7) {
            continue;
        }

        const fsName = parts[0];
        const type = parts[1];
        const size = parseInt(parts[2], 10) * 1024;
        const used = parseInt(parts[3], 10) * 1024;
        const available = parseInt(parts[4], 10) * 1024;
        const total = used + available;
        const use = total > 0 ? parseFloat((100.0 * used / total).toFixed(2)) : 0;
        const mount = parts.slice(6).join(" ");

        if (!isNaN(size) && !isNaN(used) && !isNaN(available) && mount) {
            if (!result.some(el => el.fs === fsName && el.type === type && el.mount === mount)) {
                result.push({ fs: fsName, type, size, used, available, use, mount });
            }
        }
    }

    return result;
}

export function parseDfOutputMacOS(stdout: string): FsSizeData[] {
    const lines = stdout.split("\n");
    const headerLine = lines.find(line => line.trim() !== "") || "";
    const blockSize = headerLine.includes("512-blocks") ? 512 : 1024;
    const dataLines = lines.filter(line => {
        const trimmed = line.trim();
        return trimmed !== "" && !trimmed.toLowerCase().startsWith("filesystem");
    });

    const result: FsSizeData[] = [];

    for (const rawLine of dataLines) {
        const parts = rawLine.replace(/ +/g, " ").trim().split(" ");
        // macOS may return either:
        // 1. Filesystem 1024-blocks Used Available Capacity Mounted-on
        // 2. Filesystem 512-blocks Used Available Capacity iused ifree %iused Mounted on
        if (parts.length < 6) {
            continue;
        }

        const fsName = parts[0];
        const type = getMacOsFsType(fsName);
        const size = parseInt(parts[1], 10) * blockSize;
        const used = parseInt(parts[2], 10) * blockSize;
        const available = parseInt(parts[3], 10) * blockSize;

        let use = 0;
        let mount = "";

        if (parts.length >= 9 && parts[7].endsWith("%")) {
            use = parseFloat(parts[4].replace("%", "")) || 0;
            mount = parts.slice(8).join(" ");
        } else if (parts[4].endsWith("%")) {
            use = parseFloat(parts[4].replace("%", "")) || 0;
            mount = parts.slice(5).join(" ");
        }

        if (!isNaN(size) && !isNaN(used) && !isNaN(available) && mount) {
            if (!result.some(el => el.fs === fsName && el.type === type && el.mount === mount)) {
                result.push({ fs: fsName, type, size, used, available, use, mount });
            }
        }
    }

    return result;
}

export function parseFsSizeOutputSystemInformation(
    data: Awaited<ReturnType<typeof si.fsSize>>,
): FsSizeData[] {
    const result: FsSizeData[] = [];

    for (const entry of data) {
        const size = typeof entry.size === "number" ? entry.size : 0;
        const used = typeof entry.used === "number" ? entry.used : 0;
        const available = Math.max(0, size - used);
        const use = typeof entry.use === "number"
            ? parseFloat(entry.use.toFixed(2))
            : (size > 0 ? parseFloat((100.0 * used / size).toFixed(2)) : 0);
        const fsName = (entry.fs || entry.mount || "").trim();
        const mount = (entry.mount || entry.fs || "").trim();
        const type = (entry.type || "unknown").trim();

        if (!mount || size <= 0) {
            continue;
        }

        if (!result.some((el) => el.fs === fsName && el.type === type && el.mount === mount)) {
            result.push({
                fs: fsName,
                type,
                size,
                used,
                available,
                use,
                mount,
            });
        }
    }

    return result;
}

export async function getFsSize(): Promise<FsSizeData[]> {
    if (IS_WIN32) {
        try {
            return parseFsSizeOutputSystemInformation(await si.fsSize());
        } catch {
            return [];
        }
    }

    if (IS_DARWIN) {
        try {
            const { stdout } = await execAsync("df -kP 2>/dev/null", { maxBuffer: 1024 * 1024 });
            return parseDfOutputMacOS(stdout);
        } catch {
            try {
                return parseFsSizeOutputSystemInformation(await si.fsSize());
            } catch {
                return [];
            }
        }
    }

    if (IS_LINUX) {
        try {
            const { stdout } = await execAsync("export LC_ALL=C; df -kPT 2>/dev/null; unset LC_ALL", { maxBuffer: 1024 * 1024 });
            return parseDfOutputLinux(stdout);
        } catch {
            try {
                return parseFsSizeOutputSystemInformation(await si.fsSize());
            } catch {
                return [];
            }
        }
    }

    return [];
}

export function shouldShowMacOsFileSystem(fs: FsSizeData): boolean {
    const mountLower = fs.mount.toLowerCase();

    if (mountLower === "/system/volumes/data") {
        return true;
    }

    if (mountLower.startsWith("/volumes/")) {
        return true;
    }

    return false;
}

export function isTmpFs(fs: string): boolean {
    const fsLower = fs.toLowerCase();
    return TMP_FILESYSTEMS.some(tmpFs => fsLower.includes(tmpFs));
}

export function shouldShowFileSystem(fs: FsSizeData, platform: NodeJS.Platform = process.platform): boolean {
    if (fs.size < MINIMUM_DISK_SIZE) {
        return false;
    }

    if (isTmpFs(fs.type)) {
        return false;
    }

    const mountLower = fs.mount.toLowerCase();
    if (EXCLUDED_MOUNT_PREFIXES.some(prefix => mountLower.startsWith(prefix))) {
        return false;
    }

    if (platform === "darwin") {
        return shouldShowMacOsFileSystem(fs);
    }

    return true;
}

export function filterDisplayedFileSystems(fsData: FsSizeData[], platform: NodeJS.Platform = process.platform): FsSizeData[] {
    const isDarwin = platform === "darwin";
    const hasMacOsDataVolume = isDarwin && fsData.some(fs => fs.mount.toLowerCase() === "/system/volumes/data");

    return fsData.filter(fs => {
        if (hasMacOsDataVolume && fs.mount === "/") {
            return false;
        }

        return shouldShowFileSystem(fs, platform);
    });
}
