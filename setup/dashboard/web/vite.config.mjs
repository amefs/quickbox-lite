// SPDX-License-Identifier: GPL-3.0-or-later

import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import ts from "typescript";
import { buildDashboardReact } from "./build/react.mjs";

const webRoot = path.dirname(fileURLToPath(import.meta.url));
const sourceRoot = `${path.join(webRoot, "src")}${path.sep}`;
const target = "es2022";

// Paths the dashboard serves. The gateway serves every other path
// (/deluge/, /<user>.console); the production server answers those with 404.
const SPA_ENTRY_PATHS = new Set([
    "/",
    "/index.html",
    "/ws",
    "/ws/",
    "/ws/index.html",
    "/debug",
    "/debug/",
    "/ws/debug",
    "/ws/debug/",
]);

// Sources, assets, and API prefixes the dev server serves or proxies itself.
const DEV_SERVER_PREFIXES = [
    "/@",
    "/src/",
    "/node_modules/",
    "/img/",
    "/css/",
    "/assets/",
    "/skins/",
    "/node",
    "/ws/node",
    "/set",
    "/db",
    "/socket.io",
    "/debug",
    "/ws/debug",
];

function escapeHtml(value) {
    return value.replace(/[&<>"']/g, (character) => `&#${character.charCodeAt(0)};`);
}

function renderUnservedPathPage(pathname) {
    const target = escapeHtml(pathname);
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Not served here — QuickBox dashboard dev server</title>
    <style>
        :root { color-scheme: light dark; }
        body { margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #f5f6f8; color: #1f2328; font: 15px/1.6 system-ui, sans-serif; }
        main { max-width: 40rem; padding: 2rem; }
        h1 { margin: 0 0 .75rem; font-size: 1.35rem; }
        code { padding: .1rem .35rem; border-radius: .25rem; background: #e6e8eb; color: #8a5a00; }
        a { color: #0b62c4; }
        p { margin: .5rem 0; }
        @media (prefers-color-scheme: dark) {
            body { background: #1b1e24; color: #e6e8eb; }
            code { background: #2a2f38; color: #ffd479; }
            a { color: #6cb6ff; }
        }
    </style>
</head>
<body>
    <main>
        <h1>404 — <code>${target}</code></h1>
        <p>The dashboard dev server serves <code>/</code>, <code>/ws/</code>,
           <code>/debug</code>, and <code>/ws/debug</code>.</p>
        <p><a href="/">Dashboard</a></p>
    </main>
</body>
</html>`;
}

function rejectUnservedPaths() {
    return {
        name: "reject-unserved-paths",
        apply: "serve",
        configureServer(server) {
            server.middlewares.use((req, res, next) => {
                if (req.method !== "GET" && req.method !== "HEAD") {
                    return next();
                }
                if (!(req.headers.accept ?? "").includes("text/html")) {
                    return next();
                }
                let pathname;
                try {
                    pathname = decodeURI(new URL(req.url ?? "/", "http://localhost").pathname);
                } catch {
                    return next();
                }
                if (SPA_ENTRY_PATHS.has(pathname)) {
                    return next();
                }
                if (DEV_SERVER_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
                    return next();
                }
                res.statusCode = 404;
                res.setHeader("content-type", "text/html; charset=utf-8");
                res.setHeader("cache-control", "no-store");
                res.end(req.method === "HEAD" ? undefined : renderUnservedPathPage(pathname));
            });
        },
    };
}

function cacheBustAssets() {
    return {
        name: "cache-bust-assets",
        enforce: "post",
        generateBundle: {
            order: "post",
            handler(_options, bundle) {
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
                    html = html.replace(/href="\.\/(css\/[\w-]+\.css)"/g, (_attribute, fileName) => {
                        const stylesheet = fs.readFileSync(path.join(webRoot, "public", fileName));
                        const hash = createHash("sha256").update(stylesheet).digest("hex").slice(0, 12);
                        const prefix = fileName === "css/dashboard.css" ? "/" : "./";
                        return `href="${prefix}${fileName}?v=${hash}"`;
                    });
                    htmlAsset.source = html;
                }
            },
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

const config = {
    root: webRoot,
    base: "./",
    configFile: false,
    plugins: [
        rejectUnservedPaths(),
        separateModules(),
        cacheBustAssets(),
    ],
    build: {
        target,
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
                codeSplitting: {
                    groups: [
                        { name: "i18n", test: /(?:[/\\]src[/\\]i18n[/\\]|[/\\]node_modules[/\\](?:i18next|react-i18next)[/\\])/, priority: 2 },
                        { name: "antd", test: /[/\\]node_modules[/\\](?:antd|@ant-design|@rc-component)[/\\]/, priority: 1, entriesAware: true },
                        { name: "vendor", test: /[/\\]node_modules[/\\]/, entriesAware: true },
                    ],
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
};

export default defineConfig(async ({ command }) => {
    if (command !== "build") {
        return config;
    }
    const react = await buildDashboardReact(webRoot, target);
    return {
        ...config,
        plugins: [...config.plugins, ...react.plugins],
        build: {
            ...config.build,
            rolldownOptions: {
                ...config.build.rolldownOptions,
                external: ["react"],
                output: { ...config.build.rolldownOptions.output, paths: { react: react.url } },
            },
        },
    };
});
