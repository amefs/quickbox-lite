
import pkgList from "../config/packages.json";

import { username } from "./shared/constants";

export const packageMap: Record<string, Service> = {};
export const packageList = pkgList as Service[];

interface ServiceDetail {
    process: string;
    name: string;
    username: string;
    tooltips?: string;
    tooltipsicon?: string;
}

type ServiceDetailList = Record<string, ServiceDetail>;

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

export const serviceMap = new Map<string, ServiceDetail>();

for (const pkg of pkgList as Service[]) {
    if (pkg.lockfile && pkg.lockfile.includes("$username$")) {
        pkg.lockfile = pkg.lockfile.replaceAll("$username$", username);
    }
    if (pkg.services) {
        for (const [key, service] of Object.entries(pkg.services)) {
            if (service.username && service.username.includes("$username$")) {
                service.username = service.username.replaceAll("$username$", username);
            }
            if (service.tooltips && service.tooltips.includes("$username$")) {
                service.tooltips = service.tooltips.replaceAll("$username$", username);
            }
            serviceMap.set(key, service);
        }
    }
    const packageName = pkg.package;
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
