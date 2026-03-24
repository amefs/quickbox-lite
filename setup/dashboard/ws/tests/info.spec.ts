// SPDX-License-Identifier: GPL-3.0-or-later
/* eslint-disable @typescript-eslint/no-unused-expressions */

import "mocha";
import { expect } from "chai";
import { execFileSync } from "child_process";
import { readFileSync } from "fs";
import { resolve } from "path";

import { packageMap, packageList, serviceMap, getPackage, Service } from "../src/info";

describe("info", () => {
    describe("packageMap", () => {
        it("should contain packages loaded from config", () => {
            expect(Object.keys(packageMap).length).to.be.greaterThan(0);
        });

        it("should have correct package structure", () => {
            for (const [key, pkg] of Object.entries(packageMap)) {
                expect(pkg).to.have.property("package").that.equals(key);
                expect(pkg).to.have.property("name").that.is.a("string");
            }
        });
    });

    describe("packageList", () => {
        it("should be a non-empty array", () => {
            expect(packageList).to.be.an("array");
            expect(packageList.length).to.be.greaterThan(0);
        });

        it("should have Service interface conforming items", () => {
            for (const pkg of packageList) {
                expect(pkg).to.have.property("package");
                expect(pkg).to.have.property("name");
            }
        });
    });

    describe("serviceMap", () => {
        it("should contain services from packages with services defined", () => {
            // At minimum, irssi should be in serviceMap from autodlirssi package
            const hasServices = packageList.some((pkg: Service) => pkg.services !== undefined);
            if (hasServices) {
                expect(serviceMap.size).to.be.greaterThan(0);
            }
        });

        it("should have process and name in each service", () => {
            for (const [, service] of serviceMap) {
                expect(service).to.have.property("process").that.is.a("string");
                expect(service).to.have.property("name").that.is.a("string");
            }
        });
    });

    describe("getPackage", () => {
        it("should return package when found", () => {
            const firstPkg = packageList[0];
            const result = getPackage(firstPkg.package);
            expect(result).to.not.be.null;
            expect(result?.name).to.equal(firstPkg.name);
        });

        it("should return null for non-existent package", () => {
            const result = getPackage("nonexistent-package-xyz");
            expect(result).to.be.null;
        });

        it("should return null for empty string", () => {
            const result = getPackage("");
            expect(result).to.be.null;
        });
    });

    // A6: replaceAll — no field in the loaded info should still contain raw "$username$" placeholder
    describe("username placeholder replacement", () => {
        it("should replace all $username$ placeholders in lockfile fields", () => {
            for (const pkg of packageList) {
                if (pkg.lockfile) {
                    expect(pkg.lockfile).to.not.include("$username$",
                        `lockfile of '${pkg.package}' still contains $username$`);
                }
            }
        });

        it("should replace all $username$ placeholders in service username fields", () => {
            for (const [key, service] of serviceMap) {
                expect(service.username).to.not.include("$username$",
                    `service '${key}' username still contains $username$`);
            }
        });

        it("should replace all $username$ placeholders in service tooltips fields", () => {
            for (const [key, service] of serviceMap) {
                if (service.tooltips) {
                    expect(service.tooltips).to.not.include("$username$",
                        `service '${key}' tooltips still contains $username$`);
                }
            }
        });
    });

    describe("php compatibility", () => {
        it("should load the same packages in php info.package.php", () => {
            const dashboardRoot = resolve(__dirname, "../..");
            const phpScript = `$_SERVER['DOCUMENT_ROOT'] = ${JSON.stringify(dashboardRoot)}; require 'inc/info.package.php'; echo json_encode($packageList, JSON_UNESCAPED_SLASHES);`;
            const phpResult = execFileSync("php", ["-r", phpScript], {
                cwd: dashboardRoot,
                encoding: "utf8",
            });
            const phpPackageList = JSON.parse(phpResult) as Service[];
            const username = readFileSync(resolve(dashboardRoot, "db/master.txt"), "utf8").split("\n")[0].trim();
            const rawPackageConfig = readFileSync(resolve(dashboardRoot, "ws/config/packages.json"), "utf8");
            const normalizedPackageList = JSON.parse(rawPackageConfig.replaceAll("$username$", username)) as Service[];

            expect(phpPackageList).to.deep.equal(normalizedPackageList);
        });
    });
});
