import { existsSync } from "fs";

import { packageList, Service } from "../info";

export function isPackageInstalled(pkg: Pick<Service, "lockfile">) {
    return typeof pkg.lockfile === "string" && pkg.lockfile.length > 0 && existsSync(pkg.lockfile);
}

export function getInstalledPackagesWithServices() {
    return packageList.filter((pkg) => pkg.services && isPackageInstalled(pkg));
}

export function getVisiblePackages() {
    return packageList.filter((pkg) => !pkg.skip);
}

export function isServiceEnabled(service: string, username: string) {
    return existsSync(`/etc/systemd/system/multi-user.target.wants/${service}@${username}.service`) ||
        existsSync(`/etc/systemd/system/multi-user.target.wants/${service}.service`);
}
