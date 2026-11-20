// SPDX-License-Identifier: GPL-3.0-or-later

import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { build } from "vite";

const require = createRequire(import.meta.url);
const reactSubpaths = {
    "react-dom": "reactDOM",
    "react-dom/client": "reactDOMClient",
    "react/jsx-runtime": "reactJSXRuntime",
};

function exportRuntime(specifier) {
    const names = Object.keys(require(specifier)).sort().join(", ");
    return `export default runtime; export const { ${names} } = runtime;`;
}

function reactSubpathImports() {
    const prefix = "\0quickbox-react:";
    return {
        name: "quickbox-react-subpaths",
        enforce: "pre",
        resolveId(id) {
            if (Object.hasOwn(reactSubpaths, id)) {
                return prefix + id;
            }
        },
        load(id) {
            if (id.startsWith(prefix)) {
                const specifier = id.slice(prefix.length);
                return `import { ${reactSubpaths[specifier]} as runtime } from "react"; ${exportRuntime(specifier)}`;
            }
        },
    };
}

export async function buildDashboardReact(root, target) {
    const entry = "quickbox-vendor:react";
    const fileName = "assets/react.js";
    const result = await build({
        configFile: false,
        root,
        logLevel: "warn",
        plugins: [{
            name: "quickbox-react-entry",
            resolveId(id) {
                if (id === entry) {
                    return `\0${entry}`;
                }
            },
            load(id) {
                if (id === `\0${entry}`) {
                    return [
                        'import runtime from "react";',
                        exportRuntime("react"),
                        ...Object.entries(reactSubpaths).map(([specifier, name]) => `export { default as ${name} } from "${specifier}";`),
                    ].join("\n");
                }
            },
        }],
        build: {
            target,
            write: false,
            rolldownOptions: {
                input: entry,
                preserveEntrySignatures: "strict",
                output: {
                    comments: false,
                    codeSplitting: false,
                    entryFileNames: fileName,
                },
            },
        },
    });

    const [chunk] = result.output;
    const hash = createHash("sha256").update(chunk.code).digest("hex").slice(0, 8);
    return {
        url: `./react.js?v=${hash}`,
        plugins: [
            reactSubpathImports(),
            {
                name: "quickbox-react-asset",
                generateBundle() {
                    this.emitFile({ type: "asset", fileName, source: chunk.code });
                },
            },
        ],
    };
}
