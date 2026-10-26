// SPDX-License-Identifier: GPL-3.0-or-later

import { builtinModules } from "node:module";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const packageJson = JSON.parse(readFileSync(path.join(packageRoot, "package.json"), "utf8"));
const dependencyNames = Object.keys(packageJson.dependencies ?? {});
const builtinNames = new Set(builtinModules.flatMap((name) => [name, `node:${name}`]));

function isExternal(id) {
    return builtinNames.has(id) || dependencyNames.some((name) => id === name || id.startsWith(`${name}/`));
}

export default defineConfig({
    build: {
        target: "node24",
        minify: true,
        outDir: path.join(packageRoot, "dist"),
        emptyOutDir: true,
        lib: {
            entry: path.join(packageRoot, "src", "server.tsx"),
            formats: ["cjs"],
            fileName: () => "server.js",
        },
        rollupOptions: {
            external: isExternal,
        },
    },
});
