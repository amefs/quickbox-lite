// SPDX-License-Identifier: GPL-3.0-or-later

import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import ts from "typescript";

const webRoot = path.dirname(fileURLToPath(import.meta.url));
const sourceRoot = `${path.join(webRoot, "src")}${path.sep}`;

function cacheBustAssets() {
    return {
        name: "cache-bust-assets",
        enforce: "post",
        generateBundle(_options, bundle) {
            const hashes = new Map();
            for (const chunk of Object.values(bundle)) {
                if (chunk.type === "chunk") {
                    const hash = createHash("sha256").update(chunk.code).digest("hex").slice(0, 8);
                    hashes.set(chunk.fileName, hash);
                }
            }
            for (const chunk of Object.values(bundle)) {
                if (chunk.type !== "chunk") {
                    continue;
                }
                for (const [fileName, hash] of hashes) {
                    const baseName = path.posix.basename(fileName);
                    chunk.code = chunk.code.replaceAll(`./${baseName}`, `./${baseName}?v=${hash}`);
                }
            }
            const htmlAsset = bundle["index.html"];
            if (htmlAsset?.type === "asset" && typeof htmlAsset.source === "string") {
                let html = htmlAsset.source.replace(/^  (<(?:script|link)\b)/gm, "    $1");
                for (const [fileName, hash] of hashes) {
                    html = html.replaceAll(`./${fileName}`, `./${fileName}?v=${hash}`);
                }
                const dashboardCss = fs.readFileSync(path.join(webRoot, "public", "css", "dashboard.css"));
                const cssHash = createHash("sha256").update(dashboardCss).digest("hex").slice(0, 12);
                html = html.replace("./css/dashboard.css", `/css/dashboard.css?v=${cssHash}`);
                htmlAsset.source = html;
            }
        },
    };
}

function escapeTemplateNewlines(code, fileName) {
    const source = ts.createSourceFile(fileName, code, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
    const edits = [];
    const flattenLiteral = (literal) => {
        const start = literal.getStart(source);
        const end = literal.end;
        const raw = code.slice(start, end);
        if (/\r|\n/.test(raw)) {
            edits.push({ start, end, text: raw.replace(/\r\n|\r|\n/g, "\\n") });
        }
    };
    const visit = (node) => {
        if (ts.isNoSubstitutionTemplateLiteral(node)) {
            flattenLiteral(node);
        } else if (ts.isTemplateExpression(node)) {
            flattenLiteral(node.head);
            for (const span of node.templateSpans) {
                flattenLiteral(span.literal);
            }
        }
        ts.forEachChild(node, visit);
    };
    visit(source);
    for (const edit of edits.sort((a, b) => b.start - a.start)) {
        code = `${code.slice(0, edit.start)}${edit.text}${code.slice(edit.end)}`;
    }
    return code;
}

function separateModules() {
    return {
        name: "separate-minified-modules",
        enforce: "post",
        apply: "build",
        transform(code, id) {
            const sourceId = id.split("?")[0];
            if (!sourceId.startsWith(sourceRoot)) {
                return null;
            }
            const moduleName = path.relative(sourceRoot, sourceId).replaceAll("\\", "/");
            return `globalThis.__QBL_MODULE_BOUNDARY__(${JSON.stringify(moduleName)});\n${code}`;
        },
        generateBundle(_options, bundle) {
            for (const chunk of Object.values(bundle)) {
                if (chunk.type !== "chunk") {
                    continue;
                }
                chunk.code = chunk.code.replace(/globalThis\.__QBL_MODULE_BOUNDARY__\((?:"[^"]*"|'[^']*'|`[^`]*`)\)/g, "0\n").trimStart();
                chunk.code = `${escapeTemplateNewlines(chunk.code, chunk.fileName).replace(/\n+/g, "\n").trim()}\n`;
            }
        },
    };
}

export default defineConfig({
    root: webRoot,
    base: "./",
    configFile: false,
    plugins: [
        separateModules(),
        cacheBustAssets(),
    ],
    build: {
        target: "es2022",
        minify: true,
        outDir: path.join(webRoot, "dist"),
        emptyOutDir: true,
        cssCodeSplit: false,
        chunkSizeWarningLimit: 1200,
        rolldownOptions: {
            onwarn(warning, defaultHandler) {
                if (warning.code === "MODULE_LEVEL_DIRECTIVE") {
                    return;
                }
                defaultHandler(warning);
            },
            output: {
                comments: false,
                entryFileNames: "assets/[name].js",
                chunkFileNames: "assets/[name].js",
                assetFileNames: "assets/[name][extname]",
                manualChunks(id) {
                    const normalizedId = id.replaceAll("\\", "/");
                    if (
                        normalizedId.includes("/src/i18n/") ||
                        normalizedId.includes("node_modules/i18next") ||
                        normalizedId.includes("node_modules/react-i18next")
                    ) {
                        return "i18n";
                    }
                    if (normalizedId.includes("node_modules/antd") || normalizedId.includes("node_modules/@ant-design") || normalizedId.includes("node_modules/@rc-component")) {
                        return "antd";
                    }
                    if (normalizedId.includes("node_modules/react") || normalizedId.includes("node_modules/react-dom") || normalizedId.includes("node_modules/scheduler")) {
                        return "react";
                    }
                    if (normalizedId.includes("node_modules/")) {
                        return "vendor";
                    }
                    return undefined;
                },
            },
        },
    },
    server: {
        proxy: {
            "/node/": "http://127.0.0.1:8575",
            "/ws/node/": "http://127.0.0.1:8575",
            "/socket.io": { target: "http://127.0.0.1:8575", ws: true },
            "/db": "http://127.0.0.1:8575",
            "/set": "http://127.0.0.1:8575",
            "/debug/meta": "http://127.0.0.1:8575",
            "/debug/node": "http://127.0.0.1:8575",
        },
    },
});
