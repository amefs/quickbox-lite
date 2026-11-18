import globals from "globals";
import pluginJs from "@eslint/js";

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
  rules: {
    semi: ["error", "always"],
    quotes: ["error", "double"],
    "quote-props": ["off"],
    camelcase: ["off"],
    "object-shorthand": ["error", "properties"],
  }
}];
