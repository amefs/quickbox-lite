// SPDX-License-Identifier: GPL-3.0-or-later

import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dashboardRoot = path.resolve(packageRoot, "..");

export default defineConfig({
    configFile: false,
    define: {
        "process.env.NODE_ENV": JSON.stringify("production"),
    },
    build: {
        target: "es2022",
        minify: "esbuild",
        outDir: path.join(dashboardRoot, "js", "client"),
        emptyOutDir: true,
        cssCodeSplit: false,
        lib: {
            entry: path.join(packageRoot, "src", "client", "service-control-client.tsx"),
            formats: ["es"],
            fileName: () => "dashboard-client.js",
        },
        rollupOptions: {
            output: {
                entryFileNames: "dashboard-client.[hash:8].js",
                chunkFileNames: "chunks/[name].[hash].js",
            },
            plugins: [
                {
                    name: "dashboard-client-manifest",
                    generateBundle(_options, bundle) {
                        const entry = Object.values(bundle).find((asset) =>
                            asset.type === "chunk" && asset.isEntry && asset.facadeModuleId?.endsWith("/src/client/service-control-client.tsx"),
                        );
                        if (!entry || entry.type !== "chunk") {
                            throw new Error("Vite did not emit the dashboard client entry");
                        }
                        this.emitFile({
                            type: "asset",
                            fileName: "dashboard-client-manifest.json",
                            source: `${JSON.stringify({ version: 1, dashboardClient: `/js/client/${entry.fileName}` }, null, 2)}\n`,
                        });
                    },
                },
            ],
        },
    },
});
