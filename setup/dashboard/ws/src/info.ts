
import pkgList from "../config/packages.json";

import { username } from "./constant";

export const packageMap: { [key: string]: Service } = {};
export const packageList = pkgList as Service[];

interface ServiceDetail {
    process: string;
    name: string;
    username: string;
    tooltips?: string;
    tooltipsicon?: string;
}

interface ServiceDetailList {
    [key: string]: ServiceDetail;
}

export interface Service {
    package: string;
    name: string;
    description?: string;
    lockfile?: string;
    boxonly?: boolean;
    install?: string;
    uninstall?: string;
    skip?: boolean;
    services?: ServiceDetailList;
}

for (const pkg of pkgList as Service[]) {
    if (pkg.lockfile && pkg.lockfile.includes("$username$")) {
        pkg.lockfile = pkg.lockfile.replace("$username$", username);
    }
    if (pkg.services) {
        for (const service of Object.values(pkg.services)) {
            if (service.username && service.username.includes("$username$")) {
                service.username = service.username.replace("$username$", username);
            }
            if (service.tooltips && service.tooltips.includes("$username$")) {
                service.tooltips = service.tooltips.replace("$username$", username);
            }
        }
    }
    const packageName = pkg.package.toString();
    if (packageName in packageMap) {
        console.error(`package '${packageName}' duplicated in package list!`);
    }
    packageMap[packageName] = pkg;
}

export function getPackage(packageName: string){
    if (packageName in packageMap) {
        return packageMap[packageName];
    }
    return null;
}
