// SPDX-License-Identifier: GPL-3.0-or-later

"use strict";

module.exports = {
  "root": true,
  "env": {
    "browser": true,
    "es6": true,
    "jquery": true
  },
  "ignorePatterns": [
    "build",
    "dist",
    "node_modules",
    "**/*.ts"
  ],
  "extends": [
    "eslint:recommended",
    "standard"
  ],
  "rules": {
    "semi": [
      "error",
      "always"
    ],
    "quotes": [
      "error",
      "double"
    ],
    "quote-props": [
      "off"
    ],
    "camelcase": [
      "off"
    ]
  }
};
