import { existsSync } from "fs";

import { packageList, Service } from "./info";

const INSTALLED_PACKAGES_CACHE_TTL_MS = 2_000;
let installedPackagesCache: typeof packageList = [];
let installedPackagesCacheExpiresAt = 0;

export function isPackageInstalled(pkg: Pick<Service, "lockfile">) {
    return typeof pkg.lockfile === "string" && pkg.lockfile.length > 0 && existsSync(pkg.lockfile);
}

export function getInstalledPackagesWithServices() {
    const useCache = process.env.NODE_ENV !== "test";
    if (useCache && installedPackagesCacheExpiresAt > Date.now()) {
        return installedPackagesCache;
    }
    installedPackagesCache = packageList.filter((pkg) => pkg.services && isPackageInstalled(pkg));
    if (useCache) {
        installedPackagesCacheExpiresAt = Date.now() + INSTALLED_PACKAGES_CACHE_TTL_MS;
    }
    return installedPackagesCache;
}

export function invalidateInstalledPackagesCache() {
    installedPackagesCacheExpiresAt = 0;
}

export function getVisiblePackages() {
    return packageList.filter((pkg) => !pkg.skip);
}

export function isServiceEnabled(service: string, username: string) {
    return existsSync(`/etc/systemd/system/multi-user.target.wants/${service}@${username}.service`) ||
        existsSync(`/etc/systemd/system/multi-user.target.wants/${service}.service`);
}
