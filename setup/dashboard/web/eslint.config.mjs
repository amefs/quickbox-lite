// @ts-check
// SPDX-License-Identifier: GPL-3.0-or-later

import globals from "globals";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig } from "eslint/config";
import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import stylistic from "@stylistic/eslint-plugin";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig(
    {
        ignores: ["**/dist", "**/node_modules", "**/*.js", "**/*.mjs", "**/*.cjs"],
    },
    {
        plugins: {
            "@stylistic": stylistic,
        },
    },
    eslint.configs.recommended,
    ...tseslint.configs.strict,
    ...tseslint.configs.stylistic,
    ...tseslint.configs.strictTypeChecked,
    {
        files: ["src/**/*.ts", "src/**/*.tsx"],
        languageOptions: {
            globals: {
                ...globals.browser,
            },
            ecmaVersion: 2022,
            sourceType: "module",
            parserOptions: {
                project: "./tsconfig.json",
                tsconfigRootDir: __dirname,
            },
        },
        rules: {
            "@stylistic/indent": [
                "error",
                4,
                {
                    SwitchCase: 1,
                },
            ],
            "@stylistic/quotes": [
                "error",
                "double",
                {
                    avoidEscape: true,
                },
            ],
            "@stylistic/semi": ["error", "always"],
            "@stylistic/member-delimiter-style": [
                "error",
                {
                    multiline: {
                        delimiter: "semi",
                        requireLast: true,
                    },
                    singleline: {
                        delimiter: "semi",
                        requireLast: false,
                    },
                },
            ],
            "@stylistic/type-annotation-spacing": "error",

            "@typescript-eslint/no-empty-function": "error",
            "@typescript-eslint/no-empty-interface": "error",
            "@typescript-eslint/no-explicit-any": "error",
            "@typescript-eslint/no-non-null-assertion": "error",
            "@typescript-eslint/no-this-alias": "error",
            "@typescript-eslint/no-unnecessary-qualifier": "error",
            "@typescript-eslint/prefer-for-of": "error",
            "@typescript-eslint/prefer-function-type": "error",
            "@typescript-eslint/unbound-method": "error",
            "@typescript-eslint/unified-signatures": "error",
            "@typescript-eslint/array-type": "error",
            "@typescript-eslint/no-restricted-types": "error",
            "@typescript-eslint/consistent-type-assertions": "error",
            "@typescript-eslint/consistent-type-definitions": "error",
            "@typescript-eslint/restrict-template-expressions": "off",
            "@typescript-eslint/no-unsafe-assignment": "off",
            "@typescript-eslint/no-misused-promises": [
                "error",
                {
                    checksVoidReturn: false,
                },
            ],

            camelcase: "error",
            curly: "error",
            "eol-last": "error",
            eqeqeq: ["error", "always"],
            "guard-for-in": "error",
            "no-caller": "error",
            "no-cond-assign": "error",
            "no-console": "off",
            "no-debugger": "error",
            "no-duplicate-case": "error",
            "no-duplicate-imports": "error",
            "no-fallthrough": "error",
            "no-multiple-empty-lines": "error",
            "no-new-func": "error",
            "no-new-wrappers": "error",
            "no-redeclare": "error",
            "prefer-const": "error",
            "prefer-object-spread": "error",
            "quote-props": ["error", "consistent-as-needed"],
            radix: "error",
            "spaced-comment": ["error", "always"],
            "use-isnan": "error",
            "comma-dangle": ["error", "always-multiline"],
        },
    },
);
