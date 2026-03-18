// SPDX-License-Identifier: GPL-3.0-or-later
/* eslint-disable @typescript-eslint/no-unused-expressions */

import "mocha";
import { expect } from "chai";

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
});
