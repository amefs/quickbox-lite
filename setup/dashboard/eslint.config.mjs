import globals from "globals";
import pluginJs from "@eslint/js";
// import standard from "eslint-config-standard";
import pluginN from "eslint-plugin-n";
import pluginPromise from "eslint-plugin-promise";
import pluginImport from "eslint-plugin-import";

export default [{
  files: ["**/*.js"],
  ignores: ["**/build", "**/dist", "**/node_modules", "**/*.ts"],
  languageOptions: {
    globals: {
      ...globals.browser,
      ...globals.jquery
    }
  }
},
pluginJs.configs.recommended,
{
  plugins: {
    n: pluginN,
    import: pluginImport,
    promise: pluginPromise
  },
},
{
  rules: {
    semi: ["error", "always"],
    quotes: ["error", "double"],
    "quote-props": ["off"],
    camelcase: ["off"],
    "object-shorthand": ["error", "properties"],
  }
}];
