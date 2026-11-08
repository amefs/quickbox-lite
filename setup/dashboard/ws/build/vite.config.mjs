// SPDX-License-Identifier: GPL-3.0-or-later

import { builtinModules } from "node:module";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import ts from "typescript";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const packageJson = JSON.parse(readFileSync(path.join(packageRoot, "package.json"), "utf8"));
const dependencyNames = Object.keys(packageJson.dependencies ?? {});
const builtinNames = new Set(builtinModules.flatMap((name) => [name, `node:${name}`]));

function isExternal(id) {
    return (id.startsWith("../../lang/lang_") && id.endsWith(".json")) ||
        builtinNames.has(id) || dependencyNames.some((name) => id === name || id.startsWith(`${name}/`));
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
            for (const span of node.templateSpans) flattenLiteral(span.literal);
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
            const sourceRoot = `${path.join(packageRoot, "src")}${path.sep}`;
            const sourceId = id.split("?")[0];
            if (!sourceId.startsWith(sourceRoot)) return null;
            const moduleName = path.relative(sourceRoot, sourceId).replaceAll("\\", "/");
            return `globalThis.__QBL_MODULE_BOUNDARY__(${JSON.stringify(moduleName)});\n${code}`;
        },
        generateBundle(_options, bundle) {
            for (const chunk of Object.values(bundle)) {
                if (chunk.type !== "chunk") continue;
                chunk.code = chunk.code.replace(/globalThis\.__QBL_MODULE_BOUNDARY__\((?:"[^"]*"|'[^']*'|`[^`]*`)\)/g, "0\n").trimStart();
                chunk.code = `${escapeTemplateNewlines(chunk.code, chunk.fileName).replace(/\n+/g, "\n").trim()}\n`;
            }
        },
    };
}

export default defineConfig({
    plugins: [separateModules()],
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
            output: {
                comments: false,
                chunkFileNames: "[name].js",
                manualChunks(id) {
                    if (id.includes("/src/vendor/i18n/")) return "i18n";
                    if (id.includes("/src/widgets/")) return "widgets";
                },
            },
        },
    },
});
