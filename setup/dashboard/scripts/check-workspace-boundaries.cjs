// SPDX-License-Identifier: GPL-3.0-or-later

const fs = require("fs");
const path = require("path");

const dashboardRoot = path.resolve(__dirname, "..");
const checks = [
    {
        project: "frontend",
        root: path.join(dashboardRoot, "frontend"),
        forbidden: [
            /from\s+["'][^"']*\.\.\/backend(?:\/src)?[^"']*["']/,
            /import\s*\([^)]*["'][^"']*\.\.\/backend(?:\/src)?[^"']*["'][^)]*\)/,
            /from\s+["'][^"']*backend\/src[^"']*["']/,
            /import\s*\([^)]*["'][^"']*backend\/src[^"']*["'][^)]*\)/,
            /from\s+["'][^"']*\.\.\/ws(?:\/src)?[^"']*["']/,
            /import\s*\([^)]*["'][^"']*\.\.\/ws(?:\/src)?[^"']*["'][^)]*\)/,
            /from\s+["'][^"']*ws\/src[^"']*["']/,
            /import\s*\([^)]*["'][^"']*ws\/src[^"']*["'][^)]*\)/,
        ],
    },
    {
        project: "backend",
        root: path.join(dashboardRoot, "backend"),
        forbidden: [
            /from\s+["'][^"']*\.\.\/frontend\/src[^"']*["']/,
            /import\s*\([^)]*["'][^"']*\.\.\/frontend\/src[^"']*["'][^)]*\)/,
            /from\s+["'][^"']*frontend\/src[^"']*["']/,
            /import\s*\([^)]*["'][^"']*frontend\/src[^"']*["'][^)]*\)/,
            /from\s+["'][^"']*\.\.\/ws(?:\/src)?[^"']*["']/,
            /import\s*\([^)]*["'][^"']*\.\.\/ws(?:\/src)?[^"']*["'][^)]*\)/,
            /from\s+["'][^"']*ws\/src[^"']*["']/,
            /import\s*\([^)]*["'][^"']*ws\/src[^"']*["'][^)]*\)/,
        ],
    },
];
const extensions = new Set([".ts", ".tsx", ".mts", ".cts", ".js", ".jsx", ".mjs", ".cjs"]);
const skippedDirs = new Set(["dist", "node_modules"]);
const allowedReferenceFiles = new Set([
    path.normalize(path.join("backend", "tests", "split-runtime-parity.spec.ts")),
]);

function listFiles(root) {
    const pending = [root];
    const files = [];
    while (pending.length > 0) {
        const current = pending.pop();
        const entries = fs.readdirSync(current, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(current, entry.name);
            if (entry.isDirectory()) {
                if (!skippedDirs.has(entry.name)) {
                    pending.push(fullPath);
                }
                continue;
            }
            if (entry.isFile() && extensions.has(path.extname(entry.name))) {
                files.push(fullPath);
            }
        }
    }
    return files;
}

const violations = [];
for (const check of checks) {
    for (const filePath of listFiles(check.root)) {
        const relativePath = path.normalize(path.relative(dashboardRoot, filePath));
        if (allowedReferenceFiles.has(relativePath)) {
            continue;
        }
        const content = fs.readFileSync(filePath, "utf8");
        if (check.forbidden.some((pattern) => pattern.test(content))) {
            violations.push(`${check.project}: ${relativePath}`);
        }
    }
}

if (violations.length > 0) {
    console.error("Workspace boundary violations found:");
    for (const violation of violations) {
        console.error(`- ${violation}`);
    }
    process.exit(1);
}
