// @ts-check

import globals from "globals";
import path from "node:path";
import { fileURLToPath } from "node:url";

import tseslint from "typescript-eslint";
import eslint from "@eslint/js";
import stylisticJs from "@stylistic/eslint-plugin-js";
import stylisticTs from "@stylistic/eslint-plugin-ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default tseslint.config(
  {
    ignores: ["**/build", "**/dist", "**/*.js", "**/*.mjs", "src/libs/i18n/**/*.ts"],
  },
  {
    plugins: {
      "@stylistic": stylisticJs,
      "@stylistic/ts": stylisticTs,
    },
  },
  eslint.configs.recommended,
  ...tseslint.configs.strict,
  ...tseslint.configs.stylistic,
  ...tseslint.configs.strictTypeChecked,
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
      ecmaVersion: 5,
      sourceType: "module",
      parserOptions: {
        // projectService: true,
        project: "./tsconfig.json",
        tsconfigRootDir: __dirname
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
      "@stylistic/ts/member-delimiter-style": [
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
      "@stylistic/ts/type-annotation-spacing": "error",

      "@typescript-eslint/member-ordering": "error",
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
      "@typescript-eslint/adjacent-overload-signatures": "off",
      "@typescript-eslint/array-type": "error",
      "@typescript-eslint/no-restricted-types": "error",
      "@typescript-eslint/consistent-type-assertions": "error",
      "@typescript-eslint/consistent-type-definitions": "error",
      "@typescript-eslint/explicit-member-accessibility": [
        "error",
        {
          accessibility: "explicit",
        },
      ],
      "@typescript-eslint/restrict-template-expressions": "off",
      "@typescript-eslint/no-unsafe-assignment": "off",

      camelcase: "error",
      "class-methods-use-this": "error",
      complexity: "error",
      "constructor-super": "error",
      curly: "error",
      "default-case": "off",
      "dot-notation": "off",
      "eol-last": "error",
      eqeqeq: ["error", "always"],
      "guard-for-in": "error",
      "id-blacklist": ["error", "any"],
      "id-match": "error",
      "import/no-internal-modules": "off",
      "import/order": "off",
      "linebreak-style": "off",
      "max-classes-per-file": "off",
      "max-len": "off",
      "no-bitwise": "off",
      "no-caller": "error",
      "no-cond-assign": "error",
      "no-console": "off",
      "no-debugger": "error",
      "no-duplicate-case": "error",
      "no-duplicate-imports": "error",
      "no-fallthrough": "error",
      "no-invalid-this": "off",
      "no-magic-numbers": "off",
      "no-multiple-empty-lines": "error",
      "no-new-func": "error",
      "no-new-wrappers": "error",
      "no-null/no-null": "off",
      "no-redeclare": "error",
      "no-shadow": "off",

      "padding-line-between-statements": [
        "off",
        {
          blankLine: "always",
          prev: "*",
          next: "return",
        },
      ],

      "prefer-const": "error",
      "prefer-object-spread": "error",
      "quote-props": ["error", "consistent-as-needed"],
      radix: "error",

      "space-before-function-paren": [
        "error",
        {
          anonymous: "never",
          asyncArrow: "always",
          named: "never",
        },
      ],

      "spaced-comment": ["error", "always"],
      "use-isnan": "error",
      "valid-typeof": "off",
      "space-in-parens": "off",
      "comma-dangle": ["error", "always-multiline"],
    },
  }
);
