// SPDX-License-Identifier: GPL-3.0-or-later

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
    plugins: [react()],
    build: {
        outDir: "dist/client",
        emptyOutDir: false,
        rollupOptions: {
            input: "src/client.ts",
            output: {
                entryFileNames: "dashboard-client.js",
            },
        },
    },
});
