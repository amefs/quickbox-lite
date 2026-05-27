// SPDX-License-Identifier: GPL-3.0-or-later

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const backendTarget = process.env.DASHBOARD_BACKEND_URL || "http://127.0.0.1:8575";
const frontendBuildAssetProxy = {
    target: backendTarget,
    changeOrigin: true,
};

export default defineConfig({
    plugins: [react()],
    server: {
        host: "127.0.0.1",
        proxy: {
            "/app": {
                target: backendTarget,
                changeOrigin: true,
                ws: true,
                rewrite: (path) => path.replace(/^\/app/, ""),
            },
            "/assets": backendTarget,
            "/dashboard-client.js": backendTarget,
            "/vendor-jquery.css": backendTarget,
            "/vendor-ui.css": backendTarget,
            "/vendor-misc.css": backendTarget,
            "^/(fontawesome-webfont|glyphicons-halflings-regular)\\.(eot|svg|ttf|woff|woff2)": frontendBuildAssetProxy,
            "^/(gritter|gritter-light|ui-icons_[^/]+_256x240)\\.png": frontendBuildAssetProxy,
            "/node": backendTarget,
            "/db": backendTarget,
            "/skins": backendTarget,
            "/fonts": backendTarget,
            "/img": backendTarget,
            "/js": backendTarget,
            "/lang": backendTarget,
            "/socket.io": {
                target: backendTarget,
                ws: true,
            },
            "/ws/socket.io": {
                target: backendTarget,
                ws: true,
            },
        },
    },
    build: {
        outDir: "dist/client",
        emptyOutDir: false,
        manifest: true,
        rollupOptions: {
            input: "src/client.ts",
            output: {
                entryFileNames: "dashboard-client.js",
                chunkFileNames: "assets/[name]-[hash].js",
                assetFileNames: (assetInfo) => {
                    if (assetInfo.name === "style.css") {
                        return "dashboard-client.css";
                    }
                    return "[name][extname]";
                },
                manualChunks: (id) => {
                    const moduleId = id.replaceAll("\\", "/");
                    if (!moduleId.includes("/node_modules/") && !moduleId.includes("/src/vendor/")) {
                        return undefined;
                    }
                    // jQuery core and jquery.ts setup MUST be in the same chunk
                    if (
                        moduleId.includes("/node_modules/jquery/")
                        || moduleId.includes("/src/vendor/jquery")
                    ) {
                        return "vendor-jquery-core";
                    }
                    // All other vendor code in one chunk
                    return "vendor";
                },
            },
        },
    },
});
